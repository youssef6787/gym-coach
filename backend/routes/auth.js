const jwt = require("jsonwebtoken");
const express = require("express");
const bcrypt = require("bcrypt");

const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  DEFAULT_PHONE_COUNTRY_CODE,
} = require("../config/env");

const db = require("../config/db");

const router =
  express.Router();

/*
========================================
AUTH CONFIGURATION
========================================
*/

const BCRYPT_ROUNDS = 12;

/*
========================================
HELPERS
========================================
*/

const normalizeEmail = (
  email
) => {
  return String(
    email || ""
  )
    .trim()
    .toLowerCase();
};

const normalizePhone = (
  phone
) => {
  let value = String(
    phone || ""
  ).trim();

  if (!value) return "";

  value = value.replace(
    /[\s().-]/g,
    ""
  );

  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith("0")) {
    const countryCode = String(
      DEFAULT_PHONE_COUNTRY_CODE
    ).replace(/\D/g, "");

    value =
      `+${countryCode}${value.slice(1)}`;
  }

  if (!value.startsWith("+")) {
    value = `+${value}`;
  }

  return value;
};

const isValidPhone = (
  phone
) => {
  return /^\+[1-9]\d{7,14}$/.test(
    phone
  );
};

const normalizeName = (
  name
) => {
  return String(
    name || ""
  ).trim();
};

const isValidEmail = (
  email
) => {
  const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(
    email
  );
};

/*
========================================
REGISTER
========================================
*/

router.post(
  "/register",
  async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        password,
      } = req.body || {};

      /*
      ----------------------------------------
      Required fields
      ----------------------------------------
      */

      if (
        !name ||
        !email ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "جميع البيانات مطلوبة",
          });
      }

      const cleanName =
        normalizeName(name);

      const cleanEmail =
        normalizeEmail(email);

      const cleanPhone =
        normalizePhone(phone);

      const cleanPassword =
        String(password);

      /*
      ----------------------------------------
      Validate name
      ----------------------------------------
      */

      if (
        cleanName.length < 2
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "الاسم يجب أن يكون حرفين على الأقل",
          });
      }

      if (
        cleanName.length > 100
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "الاسم طويل جدًا",
          });
      }

      /*
      ----------------------------------------
      Validate email
      ----------------------------------------
      */

      if (
        !isValidEmail(
          cleanEmail
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "يرجى إدخال بريد إلكتروني صحيح",
          });
      }

      if (
        cleanEmail.length > 255
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "البريد الإلكتروني طويل جدًا",
          });
      }

      /*
      ----------------------------------------
      Validate phone
      ----------------------------------------
      */

      if (
        cleanPhone &&
        !isValidPhone(cleanPhone)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم الهاتف غير صالح. استخدم رقمًا دوليًا مثل +201012345678.",
        });
      }

      /*
      ----------------------------------------
      Validate password
      ----------------------------------------
      */

      if (
        cleanPassword.length < 6
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
          });
      }

      if (
        cleanPassword.length > 128
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "كلمة المرور طويلة جدًا",
          });
      }

      /*
      ----------------------------------------
      Check existing user
      ----------------------------------------
      */

      const [
        existingUsers,
      ] = await db.query(
        `
        SELECT
          id,
          email,
          phone
        FROM users
        WHERE LOWER(TRIM(email)) = ?
           OR (
             ? <> ''
             AND phone = ?
           )
        LIMIT 1
        `,
        [
          cleanEmail,
          cleanPhone,
          cleanPhone,
        ]
      );

      if (
        existingUsers.length > 0
      ) {
        const existingUser =
          existingUsers[0];

        /*
        --------------------------------------
        Check email specifically
        --------------------------------------
        */

        const sameEmail =
          String(
            existingUser.email || ""
          )
            .trim()
            .toLowerCase() ===
          cleanEmail;

        if (sameEmail) {
          return res.status(400).json({
            success: false,
            message:
              "البريد الإلكتروني مستخدم بالفعل",
          });
        }

        /*
        --------------------------------------
        Check phone specifically
        --------------------------------------
        */

        const samePhone =
          cleanPhone &&
          String(
            existingUser.phone || ""
          ).trim() ===
            cleanPhone;

        if (samePhone) {
          return res.status(400).json({
            success: false,
            message:
              "رقم الهاتف مستخدم بالفعل",
          });
        }
      }

      /*
      ----------------------------------------
      Hash password
      ----------------------------------------
      */

      const hashedPassword =
        await bcrypt.hash(
          cleanPassword,
          BCRYPT_ROUNDS
        );

      /*
      ----------------------------------------
      Create client account
      ----------------------------------------
      */

      const [
        result,
      ] = await db.query(
        `
        INSERT INTO users
        (
          name,
          email,
          phone,
          password,
          role
        )
        VALUES (?, ?, ?, ?, 'client')
        `,
        [
          cleanName,
          cleanEmail,
          cleanPhone || null,
          hashedPassword,
        ]
      );

      /*
      ----------------------------------------
      Create JWT
      ----------------------------------------
      */

      const token =
        jwt.sign(
          {
            id:
              result.insertId,

            role:
              "client",
          },
          JWT_SECRET,
          {
            expiresIn:
              JWT_EXPIRES_IN,
          }
        );

      /*
      ----------------------------------------
      Response
      ----------------------------------------
      */

      return res
        .status(201)
        .json({
          success: true,

          message:
            "تم إنشاء حسابك بنجاح",

          token,

          user: {
            id:
              result.insertId,

            name:
              cleanName,

            email:
              cleanEmail,

            phone:
              cleanPhone || null,

            role:
              "client",
          },
        });
    } catch (error) {
      console.error(
        "Register error:",
        error
      );

      /*
      ----------------------------------------
      Handle duplicate database constraints
      ----------------------------------------
      */

      if (
        error &&
        error.code ===
          "ER_DUP_ENTRY"
      ) {
        const duplicateMessage =
          String(
            error.sqlMessage ||
              error.message ||
              ""
          ).toLowerCase();

        if (
          duplicateMessage.includes(
            "email"
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "البريد الإلكتروني مستخدم بالفعل",
            });
        }

        if (
          duplicateMessage.includes(
            "phone"
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "رقم الهاتف مستخدم بالفعل",
            });
        }

        return res
          .status(400)
          .json({
            success: false,
            message:
              "بيانات الحساب مستخدمة بالفعل",
          });
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "حدث خطأ أثناء إنشاء الحساب",
        });
    }
  }
);

/*
========================================
LOGIN
========================================
*/

router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        email,
        identifier,
        password,
      } = req.body || {};

      /*
      ----------------------------------------
      Required fields
      ----------------------------------------
      */

      const loginIdentifier =
        String(
          identifier ??
            email ??
            ""
        ).trim();

      if (
        !loginIdentifier ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "البريد الإلكتروني أو رقم الهاتف وكلمة المرور مطلوبان",
          });
      }

      const cleanEmail =
        normalizeEmail(
          loginIdentifier
        );

      const cleanPhone =
        normalizePhone(
          loginIdentifier
        );

      const cleanPassword =
        String(password);

      /*
      ----------------------------------------
      Validate email / phone format
      ----------------------------------------
      */

      if (
        !isValidEmail(
          cleanEmail
        ) &&
        !isValidPhone(
          cleanPhone
        )
      ) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "البريد الإلكتروني أو رقم الهاتف أو كلمة المرور غير صحيحة",
          });
      }

      /*
      ----------------------------------------
      Validate password
      ----------------------------------------
      */

      if (
        !cleanPassword
      ) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "البريد الإلكتروني أو كلمة المرور غير صحيحة",
          });
      }

      /*
      ----------------------------------------
      Find user
      ----------------------------------------
      
      لا نستخدم SELECT *.
      نقرأ فقط الحقول المطلوبة.
      */

      const [
        users,
      ] = await db.query(
        `
        SELECT
          id,
          name,
          email,
          phone,
          password,
          role
        FROM users
        WHERE email = ?
           OR phone = ?
        LIMIT 1
        `,
        [
          cleanEmail,
          cleanPhone,
        ]
      );

      if (
        users.length ===
        0
      ) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "البريد الإلكتروني أو كلمة المرور غير صحيحة",
          });
      }

      const user =
        users[0];

      /*
      ----------------------------------------
      Verify password
      ----------------------------------------
      */

      const passwordMatch =
        await bcrypt.compare(
          cleanPassword,
          user.password
        );

      if (
        !passwordMatch
      ) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "البريد الإلكتروني أو كلمة المرور غير صحيحة",
          });
      }

      /*
      ----------------------------------------
      Validate role
      ----------------------------------------
      */

      const allowedRoles = [
        "admin",
        "client",
      ];

      if (
        !allowedRoles.includes(
          user.role
        )
      ) {
        console.error(
          "Invalid user role:",
          {
            userId:
              user.id,
            role:
              user.role,
          }
        );

        return res
          .status(403)
          .json({
            success: false,
            message:
              "نوع الحساب غير صالح",
          });
      }

      /*
      ----------------------------------------
      Password is correct. Login directly.
      OTP is intentionally used only for
      password recovery, not normal login.
      ----------------------------------------
      */

      const token =
        jwt.sign(
          {
            id:
              user.id,
            role:
              user.role,
          },
          JWT_SECRET,
          {
            expiresIn:
              JWT_EXPIRES_IN,
          }
        );

      return res.json({
        success: true,
        message:
          "تم تسجيل الدخول بنجاح.",
        token,
        user: {
          id:
            user.id,
          name:
            user.name,
          email:
            user.email,
          phone:
            user.phone || null,
          role:
            user.role,
        },
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "حدث خطأ في السيرفر",
        });
    }
  }
);

module.exports = router;