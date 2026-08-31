const express = require("express");
const db = require("../config/db");

const {
  verifyToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
==================================================
POST /api/exercises/day/:dayId
إضافة تمرين
==================================================
*/
router.post(
  "/day/:dayId",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const dayId = Number(req.params.dayId);

      const {
        name,
        description,
        sets,
        reps,
        rest_seconds,
        video_url,
        exercise_order,
      } = req.body;

      const exerciseName =
        typeof name === "string"
          ? name.trim()
          : "";

      if (!dayId || Number.isNaN(dayId)) {
        return res.status(400).json({
          success: false,
          message: "رقم اليوم غير صحيح",
        });
      }

      if (!exerciseName) {
        return res.status(400).json({
          success: false,
          message: "اسم التمرين مطلوب",
        });
      }

      const [days] = await db.query(
        `
        SELECT id
        FROM training_days
        WHERE id = ?
        `,
        [dayId]
      );

      if (days.length === 0) {
        return res.status(404).json({
          success: false,
          message: "اليوم غير موجود",
        });
      }

      let orderNumber = Number(exercise_order);

      if (
        !orderNumber ||
        Number.isNaN(orderNumber) ||
        orderNumber < 1
      ) {
        const [lastExercise] = await db.query(
          `
          SELECT MAX(exercise_order) AS max_order
          FROM exercises
          WHERE day_id = ?
          `,
          [dayId]
        );

        orderNumber =
          Number(lastExercise[0]?.max_order || 0) + 1;
      }

      const [result] = await db.query(
        `
        INSERT INTO exercises
        (
          day_id,
          name,
          description,
          sets,
          reps,
          rest_seconds,
          video_url,
          exercise_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          dayId,
          exerciseName,
          description || null,

          sets !== "" &&
          sets !== undefined &&
          sets !== null
            ? Number(sets)
            : null,

          reps || null,

          rest_seconds !== "" &&
          rest_seconds !== undefined &&
          rest_seconds !== null
            ? Number(rest_seconds)
            : null,

          video_url || null,
          orderNumber,
        ]
      );

      return res.status(201).json({
        success: true,
        message: "تم إضافة التمرين بنجاح",
        exerciseId: result.insertId,
      });
    } catch (error) {
      console.error(
        "POST /exercises/day/:dayId ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء إضافة التمرين",
      });
    }
  }
);

/*
==================================================
PUT /api/exercises/:id
تعديل تمرين
==================================================
*/
router.put(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const exerciseId = Number(req.params.id);

      const {
        name,
        description,
        sets,
        reps,
        rest_seconds,
        video_url,
        exercise_order,
      } = req.body;

      const exerciseName =
        typeof name === "string"
          ? name.trim()
          : "";

      if (
        !exerciseId ||
        Number.isNaN(exerciseId)
      ) {
        return res.status(400).json({
          success: false,
          message: "رقم التمرين غير صحيح",
        });
      }

      if (!exerciseName) {
        return res.status(400).json({
          success: false,
          message: "اسم التمرين مطلوب",
        });
      }

      const [existing] = await db.query(
        `
        SELECT id
        FROM exercises
        WHERE id = ?
        `,
        [exerciseId]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "التمرين غير موجود",
        });
      }

      await db.query(
        `
        UPDATE exercises
        SET
          name = ?,
          description = ?,
          sets = ?,
          reps = ?,
          rest_seconds = ?,
          video_url = ?,
          exercise_order = ?
        WHERE id = ?
        `,
        [
          exerciseName,
          description || null,

          sets !== "" &&
          sets !== undefined &&
          sets !== null
            ? Number(sets)
            : null,

          reps || null,

          rest_seconds !== "" &&
          rest_seconds !== undefined &&
          rest_seconds !== null
            ? Number(rest_seconds)
            : null,

          video_url || null,

          exercise_order !== "" &&
          exercise_order !== undefined &&
          exercise_order !== null
            ? Number(exercise_order)
            : 1,

          exerciseId,
        ]
      );

      return res.json({
        success: true,
        message: "تم تعديل التمرين بنجاح",
      });
    } catch (error) {
      console.error(
        "PUT /exercises/:id ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تعديل التمرين",
      });
    }
  }
);

/*
==================================================
DELETE /api/exercises/:id
حذف تمرين
==================================================
*/
router.delete(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const exerciseId = Number(req.params.id);

      if (
        !exerciseId ||
        Number.isNaN(exerciseId)
      ) {
        return res.status(400).json({
          success: false,
          message: "رقم التمرين غير صحيح",
        });
      }

      const [existing] = await db.query(
        `
        SELECT id
        FROM exercises
        WHERE id = ?
        `,
        [exerciseId]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "التمرين غير موجود",
        });
      }

      await db.query(
        `
        DELETE FROM exercises
        WHERE id = ?
        `,
        [exerciseId]
      );

      return res.json({
        success: true,
        message: "تم حذف التمرين بنجاح",
      });
    } catch (error) {
      console.error(
        "DELETE /exercises/:id ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء حذف التمرين",
      });
    }
  }
);

/*
==================================================
GET /api/exercises/library
مكتبة التمارين المبنية من التمارين الموجودة بالفعل
==================================================
*/
router.get(
  "/library",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const [rows] = await db.query(
        `
        SELECT
          id,
          name,
          description,
          sets,
          reps,
          rest_seconds,
          video_url,
          exercise_order
        FROM exercises
        WHERE name IS NOT NULL
          AND TRIM(name) <> ''
        ORDER BY name ASC, id DESC
        LIMIT 500
        `
      );

      const seen = new Set();
      const exercises = [];

      for (const row of rows) {
        const key = String(row.name)
          .trim()
          .toLowerCase();

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        exercises.push(row);
      }

      return res.json({
        success: true,
        exercises,
      });
    } catch (error) {
      console.error(
        "GET /exercises/library ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "تعذر تحميل مكتبة التمارين",
      });
    }
  }
);

module.exports = router;