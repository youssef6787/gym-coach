const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

/*
========================================
GET NOTIFICATIONS
========================================
*/

router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "المستخدم غير صالح",
      });
    }

    const requestedLimit = Number(req.query.limit);
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 20, 1),
      50
    );

    const [notifications] = await db.query(
      `
      SELECT
        id,
        type,
        title,
        message,
        link,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
      `,
      [userId, limit]
    );

    const [unreadRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM notifications
      WHERE user_id = ?
      AND is_read = 0
      `,
      [userId]
    );

    return res.json({
      success: true,
      notifications,
      unreadCount: Number(unreadRows[0]?.total || 0),
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذر تحميل الإشعارات",
    });
  }
});

/*
========================================
MARK ONE AS READ
========================================
*/

router.patch("/:id/read", verifyToken, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const notificationId = Number(req.params.id);

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "رقم الإشعار غير صحيح",
      });
    }

    const [result] = await db.query(
      `
      UPDATE notifications
      SET is_read = 1
      WHERE id = ?
      AND user_id = ?
      `,
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "الإشعار غير موجود",
      });
    }

    return res.json({
      success: true,
      message: "تم تحديد الإشعار كمقروء",
    });
  } catch (error) {
    console.error("Mark notification read error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذر تحديث الإشعار",
    });
  }
});

/*
========================================
MARK ALL AS READ
========================================
*/

router.patch("/read-all", verifyToken, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    await db.query(
      `
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ?
      AND is_read = 0
      `,
      [userId]
    );

    return res.json({
      success: true,
      message: "تم تحديد جميع الإشعارات كمقروءة",
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذر تحديث الإشعارات",
    });
  }
});

module.exports = router;