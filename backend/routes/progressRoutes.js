const express = require("express");

const db = require("../config/db");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const router = express.Router();


/*
========================================
GET
جلب تقدم العميل
========================================
*/

router.get(
  "/",
  verifyToken,
  async (req, res) => {
    try {

      if (req.user.role !== "client") {
        return res.status(403).json({
          success: false,
          message: "هذه الصفحة خاصة بالعملاء",
        });
      }

      const clientId = req.user.id;

      const [progress] = await db.query(
        `
        SELECT
          exercise_id,
          completed,
          completed_at

        FROM exercise_progress

        WHERE client_id = ?
        `,
        [clientId]
      );

      res.json({
        success: true,
        progress,
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء جلب تقدمك",
      });
    }
  }
);


/*
========================================
POST
تحديث حالة تمرين
========================================
*/

router.post(
  "/:exerciseId",
  verifyToken,
  async (req, res) => {
    try {

      if (req.user.role !== "client") {
        return res.status(403).json({
          success: false,
          message: "هذه الصفحة خاصة بالعملاء",
        });
      }

      const clientId = req.user.id;
      const { exerciseId } = req.params;

      const completed =
        req.body.completed === true;

      /*
        التأكد أن التمرين موجود
      */

      const [exercises] = await db.query(
        `
        SELECT id
        FROM exercises
        WHERE id = ?
        `,
        [exerciseId]
      );

      if (exercises.length === 0) {
        return res.status(404).json({
          success: false,
          message: "التمرين غير موجود",
        });
      }

      /*
        إضافة أو تحديث التقدم
      */

      await db.query(
        `
        INSERT INTO exercise_progress
        (
          client_id,
          exercise_id,
          completed,
          completed_at
        )

        VALUES (?, ?, ?, ?)

        ON DUPLICATE KEY UPDATE
          completed = VALUES(completed),
          completed_at = VALUES(completed_at)
        `,
        [
          clientId,
          exerciseId,
          completed,
          completed
            ? new Date()
            : null,
        ]
      );

      res.json({
        success: true,
        message: completed
          ? "تم تسجيل التمرين كمكتمل"
          : "تم إلغاء إنجاز التمرين",
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء حفظ تقدم التمرين",
      });
    }
  }
);


module.exports = router;