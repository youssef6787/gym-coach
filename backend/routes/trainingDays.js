const express = require("express");
const db = require("../config/db");

const {
  verifyToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
==================================================
POST /api/training-days/program/:programId
إضافة يوم جديد
رقم اليوم يتم حسابه تلقائيًا
==================================================
*/
router.post(
  "/program/:programId",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const programId = Number(req.params.programId);

      const name =
        typeof req.body.name === "string"
          ? req.body.name.trim()
          : "";

      if (!programId || Number.isNaN(programId)) {
        return res.status(400).json({
          success: false,
          message: "رقم البرنامج غير صحيح",
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "اسم اليوم مطلوب",
        });
      }

      const [programs] = await db.query(
        `
        SELECT id
        FROM training_programs
        WHERE id = ?
        `,
        [programId]
      );

      if (programs.length === 0) {
        return res.status(404).json({
          success: false,
          message: "البرنامج غير موجود",
        });
      }

      const [lastDay] = await db.query(
        `
        SELECT MAX(day_number) AS max_day
        FROM training_days
        WHERE program_id = ?
        `,
        [programId]
      );

      const nextDayNumber =
        Number(lastDay[0]?.max_day || 0) + 1;

      const [result] = await db.query(
        `
        INSERT INTO training_days
        (
          program_id,
          day_number,
          name
        )
        VALUES (?, ?, ?)
        `,
        [
          programId,
          nextDayNumber,
          name,
        ]
      );

      return res.status(201).json({
        success: true,
        message: `تم إضافة اليوم ${nextDayNumber} بنجاح`,
        dayId: result.insertId,
        dayNumber: nextDayNumber,
      });
    } catch (error) {
      console.error(
        "POST /training-days/program/:programId ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء إضافة اليوم",
      });
    }
  }
);

/*
==================================================
PUT /api/training-days/:id
تعديل اليوم
==================================================
*/
router.put(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const dayId = Number(req.params.id);

      const name =
        typeof req.body.name === "string"
          ? req.body.name.trim()
          : "";

      const requestedDayNumber =
        req.body.day_number !== undefined &&
        req.body.day_number !== ""
          ? Number(req.body.day_number)
          : null;

      if (!dayId || Number.isNaN(dayId)) {
        return res.status(400).json({
          success: false,
          message: "رقم اليوم غير صحيح",
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "اسم اليوم مطلوب",
        });
      }

      const [days] = await db.query(
        `
        SELECT
          id,
          program_id,
          day_number
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

      const currentDay = days[0];

      let finalDayNumber =
        currentDay.day_number;

      if (
        requestedDayNumber !== null &&
        Number.isInteger(requestedDayNumber) &&
        requestedDayNumber > 0
      ) {
        finalDayNumber = requestedDayNumber;
      }

      const [duplicate] = await db.query(
        `
        SELECT id
        FROM training_days
        WHERE program_id = ?
        AND day_number = ?
        AND id != ?
        `,
        [
          currentDay.program_id,
          finalDayNumber,
          dayId,
        ]
      );

      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          message: "رقم اليوم مستخدم بالفعل",
        });
      }

      await db.query(
        `
        UPDATE training_days
        SET
          day_number = ?,
          name = ?
        WHERE id = ?
        `,
        [
          finalDayNumber,
          name,
          dayId,
        ]
      );

      return res.json({
        success: true,
        message: "تم تعديل اليوم بنجاح",
      });
    } catch (error) {
      console.error(
        "PUT /training-days/:id ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تعديل اليوم",
      });
    }
  }
);

/*
==================================================
DELETE /api/training-days/:id
حذف يوم وتمارينه
==================================================
*/
router.delete(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    let connection;

    try {
      const dayId = Number(req.params.id);

      if (!dayId || Number.isNaN(dayId)) {
        return res.status(400).json({
          success: false,
          message: "رقم اليوم غير صحيح",
        });
      }

      const [days] = await db.query(
        `
        SELECT id, program_id
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

      connection = await db.getConnection();

      await connection.beginTransaction();

      await connection.query(
        `
        DELETE FROM exercises
        WHERE day_id = ?
        `,
        [dayId]
      );

      await connection.query(
        `
        DELETE FROM training_days
        WHERE id = ?
        `,
        [dayId]
      );

      const programId = days[0].program_id;

      const [remainingDays] = await connection.query(
        `
        SELECT id
        FROM training_days
        WHERE program_id = ?
        ORDER BY day_number ASC, id ASC
        `,
        [programId]
      );

      for (let i = 0; i < remainingDays.length; i++) {
        await connection.query(
          `
          UPDATE training_days
          SET day_number = ?
          WHERE id = ?
          `,
          [
            i + 1,
            remainingDays[i].id,
          ]
        );
      }

      await connection.commit();

      return res.json({
        success: true,
        message: "تم حذف اليوم بنجاح",
      });
    } catch (error) {
      console.error(
        "DELETE /training-days/:id ERROR:",
        error
      );

      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(rollbackError);
        }
      }

      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء حذف اليوم",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

/*
==================================================
POST /api/training-days/:id/duplicate
نسخ يوم تدريبي مع جميع تمارينه داخل نفس البرنامج
==================================================
*/
router.post(
  "/:id/duplicate",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    let connection;

    try {
      const dayId = Number(req.params.id);

      if (!dayId || Number.isNaN(dayId)) {
        return res.status(400).json({
          success: false,
          message: "رقم اليوم غير صحيح",
        });
      }

      const [days] = await db.query(
        `
        SELECT
          id,
          program_id,
          day_number,
          name
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

      const source = days[0];

      const [lastDay] = await db.query(
        `
        SELECT MAX(day_number) AS max_day
        FROM training_days
        WHERE program_id = ?
        `,
        [source.program_id]
      );

      const nextDayNumber =
        Number(lastDay[0]?.max_day || 0) + 1;

      const requestedName =
        typeof req.body?.name === "string" &&
        req.body.name.trim()
          ? req.body.name.trim()
          : `${source.name || "اليوم"} - نسخة`;

      connection = await db.getConnection();

      await connection.beginTransaction();

      const [newDay] = await connection.query(
        `
        INSERT INTO training_days
        (
          program_id,
          day_number,
          name
        )
        VALUES (?, ?, ?)
        `,
        [
          source.program_id,
          nextDayNumber,
          requestedName,
        ]
      );

      const [exercises] = await connection.query(
        `
        SELECT
          name,
          description,
          sets,
          reps,
          rest_seconds,
          video_url,
          exercise_order
        FROM exercises
        WHERE day_id = ?
        ORDER BY exercise_order ASC, id ASC
        `,
        [dayId]
      );

      for (const exercise of exercises) {
        await connection.query(
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
            newDay.insertId,
            exercise.name,
            exercise.description || null,
            exercise.sets ?? null,
            exercise.reps || null,
            exercise.rest_seconds ?? null,
            exercise.video_url || null,
            exercise.exercise_order || 1,
          ]
        );
      }

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: "تم نسخ اليوم وجميع تمارينه بنجاح",
        dayId: newDay.insertId,
        dayNumber: nextDayNumber,
      });
    } catch (error) {
      console.error(
        "POST /training-days/:id/duplicate ERROR:",
        error
      );

      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(rollbackError);
        }
      }

      return res.status(500).json({
        success: false,
        message: "تعذر نسخ اليوم التدريبي",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

module.exports = router;