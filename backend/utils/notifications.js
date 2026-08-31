const db = require("../config/db");

/**
 * إنشاء إشعار لمستخدم واحد.
 */
const createNotification = async ({
  userId,
  type,
  title,
  message,
  link = null,
}) => {
  if (!Number(userId)) return false;

  try {
    await db.query(
      `
      INSERT INTO notifications
        (user_id, type, title, message, link, is_read)
      VALUES (?, ?, ?, ?, ?, 0)
      `,
      [Number(userId), type, title, message, link]
    );
    return true;
  } catch (error) {
    // فشل الإشعار لا يجب أن يمنع إرسال الرسالة أو إنشاء الاشتراك.
    console.error("Create notification error:", error);
    return false;
  }
};

/**
 * إرسال إشعار لكل المدربين (admin).
 * مفيد إذا كان النظام يحتوي أكثر من حساب مدرب.
 */
const notifyAdmins = async (payload) => {
  let admins = [];

  try {
    const [rows] = await db.query(
      `SELECT id FROM users WHERE role = 'admin'`
    );
    admins = rows;
  } catch (error) {
    console.error("Get admin users for notifications error:", error);
    return;
  }

  for (const admin of admins) {
    await createNotification({
      ...payload,
      userId: admin.id,
    });
  }
};

module.exports = {
  createNotification,
  notifyAdmins,
};
