const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const db = require("../config/db");
const {
  JWT_SECRET,
  OTP_SECRET,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  SMTP_SECURE,
  SMTP_FROM,
} = require("../config/env");

const router = express.Router();

const OTP_EXPIRES_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;

/*
========================================
AUTH OTP TABLE INITIALIZATION
========================================
The project backup did not contain the auth_otps table.
Create it automatically the first time the reset endpoints are used.
========================================
*/
let authOtpTableReady = null;

const ensureAuthOtpTable = async () => {
  if (!authOtpTableReady) {
    authOtpTableReady = db
      .query(`
        CREATE TABLE IF NOT EXISTS auth_otps (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          challenge_id VARCHAR(64) NOT NULL,
          user_id INT NOT NULL,
          purpose VARCHAR(50) NOT NULL,
          channel VARCHAR(20) NOT NULL DEFAULT 'email',
          code_hash CHAR(64) NOT NULL,
          attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
          expires_at DATETIME NOT NULL,
          verified_at DATETIME NULL,
          reset_token_hash CHAR(64) NULL,
          used_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_auth_otps_challenge_id (challenge_id),
          KEY idx_auth_otps_user_purpose (user_id, purpose, used_at),
          KEY idx_auth_otps_expires_at (expires_at),
          KEY idx_auth_otps_reset_token_hash (reset_token_hash)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      .catch((error) => {
        authOtpTableReady = null;
        throw error;
      });
  }

  await authOtpTableReady;
};

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const hashOtp = (code) =>
  crypto
    .createHmac("sha256", OTP_SECRET || JWT_SECRET)
    .update(String(code))
    .digest("hex");

const generateOtp = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, "0");

const createMailTransporter = () => {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: SMTP_USER,
      // Google may display the 16-character App Password with spaces.
      // Remove whitespace so both copied formats work.
      pass: String(SMTP_PASSWORD).replace(/\s+/g, ""),
    },
  });
};

const sendEmailOtp = async (user, otp) => {
  const transporter = createMailTransporter();

  if (!transporter) {
    throw new Error("SMTP is not configured");
  }

  const from = SMTP_FROM || SMTP_USER;

  await transporter.sendMail({
    from,
    to: user.email,
    replyTo: SMTP_USER || undefined,
    subject: "رمز استعادة كلمة المرور | GYM COACH",
    text:
      `مرحبًا ${user.name || ""}،\n\n` +
      `طلبتَ استعادة كلمة المرور لحسابك في GYM COACH.\n\n` +
      `رمز التحقق: ${otp}\n\n` +
      `الرمز صالح لمدة ${OTP_EXPIRES_MINUTES} دقائق، ويمكن استخدامه مرة واحدة فقط.\n\n` +
      `إذا لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة.`,
    html: `
      <div dir="rtl" style="margin:0;padding:24px;background:#f7f7f8;font-family:Arial,sans-serif;color:#222;line-height:1.8">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;text-align:center;border:1px solid #eee">
          <h2 style="margin:0 0 12px">GYM COACH</h2>
          <p style="margin:0 0 16px">مرحبًا ${user.name || ""}</p>
          <p style="margin:0 0 16px">طلبتَ استعادة كلمة المرور لحسابك.</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:14px 18px;background:#f3f4f6;border-radius:12px;display:inline-block;direction:ltr">${otp}</div>
          <p style="margin:18px 0 8px">الرمز صالح لمدة ${OTP_EXPIRES_MINUTES} دقائق، ويمكن استخدامه مرة واحدة فقط.</p>
          <p style="margin:0;color:#666;font-size:13px">إذا لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة.</p>
        </div>
      </div>
    `,
  });
};

const getUserByEmail = async (email) => {
  const cleanEmail = normalizeEmail(email);

  if (!isValidEmail(cleanEmail)) return null;

  const [users] = await db.query(
    `
      SELECT id, name, email, role
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [cleanEmail]
  );

  return users[0] || null;
};

const issueEmailOtp = async ({ user, purpose, challengeId }) => {
  const otp = generateOtp();
  const codeHash = hashOtp(otp);

  await db.query(
    `
      UPDATE auth_otps
      SET used_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND purpose = ?
        AND used_at IS NULL
    `,
    [user.id, purpose]
  );

  await db.query(
    `
      INSERT INTO auth_otps
      (challenge_id, user_id, purpose, channel, code_hash, expires_at)
      VALUES (?, ?, ?, 'email', ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE))
    `,
    [challengeId, user.id, purpose, codeHash, OTP_EXPIRES_MINUTES]
  );

  try {
    await sendEmailOtp(user, otp);
  } catch (error) {
    // لا نترك OTP صالحًا في قاعدة البيانات إذا فشل إرسال البريد.
    await db.query(
      `
        UPDATE auth_otps
        SET used_at = CURRENT_TIMESTAMP
        WHERE challenge_id = ?
          AND used_at IS NULL
      `,
      [challengeId]
    );
    throw error;
  }
};

/*
========================================
REQUEST PASSWORD RESET OTP - EMAIL ONLY
========================================
*/
router.post("/request-reset-otp", async (req, res) => {
  const generic = {
    success: true,
    message:
      "إذا كان البريد الإلكتروني مسجلًا، فسيتم إرسال رمز التحقق إليه.",
  };

  try {
    await ensureAuthOtpTable();

    const email = normalizeEmail(req.body?.email);
    const user = await getUserByEmail(email);

    // لا نكشف للمستخدم هل البريد موجود أم لا.
    if (!user) return res.json(generic);

    const challengeId = crypto.randomBytes(24).toString("hex");

    await issueEmailOtp({
      user,
      purpose: "password_reset",
      challengeId,
    });

    return res.json(generic);
  } catch (error) {
    console.error("Request reset OTP error:", error);

    // مهم: لا نرسل success إذا فشل SMTP، حتى لا يظن المستخدم أن الرسالة وصلت.
    return res.status(500).json({
      success: false,
      message:
        "تعذر إرسال رمز التحقق إلى البريد الإلكتروني. تأكد من إعدادات البريد وحاول مرة أخرى.",
    });
  }
});

/*
========================================
VERIFY PASSWORD RESET OTP - EMAIL ONLY
========================================
*/
router.post("/verify-reset-otp", async (req, res) => {
  try {
    await ensureAuthOtpTable();

    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").replace(/\D/g, "");
    const user = await getUserByEmail(email);

    if (!user || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "رمز التحقق غير صحيح أو منتهي الصلاحية.",
      });
    }

    const [rows] = await db.query(
      `
        SELECT id, code_hash, attempts
        FROM auth_otps
        WHERE user_id = ?
          AND purpose = 'password_reset'
          AND channel = 'email'
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY id DESC
        LIMIT 1
      `,
      [user.id]
    );

    const row = rows[0];

    if (!row || row.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(400).json({
        success: false,
        message: "رمز التحقق غير صحيح أو منتهي الصلاحية.",
      });
    }

    if (hashOtp(otp) !== row.code_hash) {
      await db.query(
        `UPDATE auth_otps SET attempts = attempts + 1 WHERE id = ?`,
        [row.id]
      );

      return res.status(400).json({
        success: false,
        message: "رمز التحقق غير صحيح أو منتهي الصلاحية.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await db.query(
      `
        UPDATE auth_otps
        SET verified_at = CURRENT_TIMESTAMP,
            reset_token_hash = ?
        WHERE id = ?
      `,
      [resetTokenHash, row.id]
    );

    return res.json({
      success: true,
      message: "تم التحقق من الرمز بنجاح.",
      resetToken,
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "تعذر التحقق من الرمز حاليًا.",
    });
  }
});

/*
========================================
RESET PASSWORD USING VERIFIED EMAIL OTP
========================================
*/
router.post("/reset-password-otp", async (req, res) => {
  await ensureAuthOtpTable();
  const connection = await db.getConnection();

  try {
    const resetToken = String(req.body?.resetToken || "").trim();
    const password = String(req.body?.password || "");

    if (!resetToken || password.length < 6 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "بيانات إعادة التعيين غير صحيحة.",
      });
    }

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT id, user_id
        FROM auth_otps
        WHERE reset_token_hash = ?
          AND purpose = 'password_reset'
          AND channel = 'email'
          AND verified_at IS NOT NULL
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1
        FOR UPDATE
      `,
      [resetTokenHash]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "جلسة إعادة التعيين غير صالحة أو انتهت صلاحيتها.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await connection.query(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, rows[0].user_id]
    );

    await connection.query(
      `
        UPDATE auth_otps
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND purpose = 'password_reset'
          AND used_at IS NULL
      `,
      [rows[0].user_id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.",
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error("Reset password OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذر تغيير كلمة المرور حاليًا.",
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
