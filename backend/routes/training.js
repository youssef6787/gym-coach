const express = require("express");
const db = require("../config/db");

const {
  verifyToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
==================================================
GET /api/training/my-program
برنامج العميل الحالي
==================================================
*/
router.get("/my-program", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({
        success: false,
        message: "هذه الصفحة خاصة بالعملاء",
      });
    }

    const clientId = Number(req.user.id);

    if (!clientId || Number.isNaN(clientId)) {
      return res.status(400).json({
        success: false,
        message: "رقم العميل غير صحيح",
      });
    }

    const [programs] = await db.query(
      `
      SELECT
        tp.id,
        tp.name,
        tp.description,
        tp.client_id,
        tp.created_at,
        u.name AS client_name,
        u.email AS client_email
      FROM training_programs tp
      INNER JOIN users u
        ON tp.client_id = u.id
      WHERE tp.client_id = ?
      ORDER BY tp.id DESC
      LIMIT 1
      `,
      [clientId]
    );

    if (programs.length === 0) {
      return res.json({
        success: true,
        program: null,
        message: "لا يوجد برنامج تدريبي مخصص لك حتى الآن",
      });
    }

    const program = programs[0];

    const [days] = await db.query(
      `
      SELECT
        id,
        program_id,
        day_number,
        name
      FROM training_days
      WHERE program_id = ?
      ORDER BY day_number ASC, id ASC
      `,
      [program.id]
    );

    for (const day of days) {
      const [exercises] = await db.query(
        `
        SELECT
          id,
          day_id,
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
        [day.id]
      );

      day.exercises = (exercises || []).map((exercise) => ({
        ...exercise,
        video_media_url: exercise.video_url
          ? `/api/media/exercise/${exercise.id}`
          : null,
        video_url: null,
      }));
    }

    program.days = days || [];

    return res.json({
      success: true,
      program,
    });
  } catch (error) {
    console.error("GET /training/my-program ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب برنامجك التدريبي",
    });
  }
});

/*
==================================================
GET /api/training
جميع البرامج للأدمن
==================================================
*/
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const [programs] = await db.query(
      `
      SELECT
        tp.id,
        tp.name,
        tp.description,
        tp.client_id,
        u.name AS client_name,
        u.email AS client_email,
        tp.created_at
      FROM training_programs tp
      INNER JOIN users u
        ON tp.client_id = u.id
      ORDER BY tp.id DESC
      `
    );

    return res.json({
      success: true,
      programs: programs || [],
    });
  } catch (error) {
    console.error("GET /training ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب البرامج التدريبية",
    });
  }
});

/*
==================================================
GET /api/training/:id
برنامج واحد مع الأيام والتمارين
==================================================
*/
router.get("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const programId = Number(req.params.id);

    if (!programId || Number.isNaN(programId)) {
      return res.status(400).json({
        success: false,
        message: "رقم البرنامج غير صحيح",
      });
    }

    const [programs] = await db.query(
      `
      SELECT
        tp.id,
        tp.name,
        tp.description,
        tp.client_id,
        u.name AS client_name,
        u.email AS client_email,
        tp.created_at
      FROM training_programs tp
      INNER JOIN users u
        ON tp.client_id = u.id
      WHERE tp.id = ?
      `,
      [programId]
    );

    if (programs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "البرنامج غير موجود",
      });
    }

    const program = programs[0];

    const [days] = await db.query(
      `
      SELECT
        id,
        program_id,
        day_number,
        name
      FROM training_days
      WHERE program_id = ?
      ORDER BY day_number ASC, id ASC
      `,
      [programId]
    );

    for (const day of days) {
      const [exercises] = await db.query(
        `
        SELECT
          id,
          day_id,
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
        [day.id]
      );

      day.exercises = exercises || [];
    }

    program.days = days || [];

    return res.json({
      success: true,
      program,
    });
  } catch (error) {
    console.error("GET /training/:id ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب البرنامج",
    });
  }
});

/*
==================================================
POST /api/training
إنشاء برنامج
==================================================
*/
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      client_id,
      name,
      description,
    } = req.body;

    const clientId = Number(client_id);

    const programName =
      typeof name === "string"
        ? name.trim()
        : "";

    const programDescription =
      typeof description === "string"
        ? description.trim()
        : "";

    if (
      !clientId ||
      Number.isNaN(clientId) ||
      !programName
    ) {
      return res.status(400).json({
        success: false,
        message: "العميل واسم البرنامج مطلوبان",
      });
    }

    const [clients] = await db.query(
      `
      SELECT id, name, email
      FROM users
      WHERE id = ?
      AND role = 'client'
      `,
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "العميل غير موجود أو ليس حساب عميل",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO training_programs
      (
        client_id,
        name,
        description
      )
      VALUES (?, ?, ?)
      `,
      [
        clientId,
        programName,
        programDescription || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "تم إنشاء البرنامج التدريبي بنجاح",
      programId: result.insertId,
    });
  } catch (error) {
    console.error("POST /training ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء إنشاء البرنامج",
    });
  }
});

/*
==================================================
PUT /api/training/:id
تعديل البرنامج
==================================================
*/
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const programId = Number(req.params.id);

    const {
      client_id,
      name,
      description,
    } = req.body;

    if (!programId || Number.isNaN(programId)) {
      return res.status(400).json({
        success: false,
        message: "رقم البرنامج غير صحيح",
      });
    }

    const clientId = Number(client_id);

    const programName =
      typeof name === "string"
        ? name.trim()
        : "";

    const programDescription =
      typeof description === "string"
        ? description.trim()
        : "";

    if (
      !clientId ||
      Number.isNaN(clientId) ||
      !programName
    ) {
      return res.status(400).json({
        success: false,
        message: "العميل واسم البرنامج مطلوبان",
      });
    }

    const [clients] = await db.query(
      `
      SELECT id
      FROM users
      WHERE id = ?
      AND role = 'client'
      `,
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "العميل غير موجود أو ليس حساب عميل",
      });
    }

    const [existing] = await db.query(
      `
      SELECT id
      FROM training_programs
      WHERE id = ?
      `,
      [programId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "البرنامج غير موجود",
      });
    }

    await db.query(
      `
      UPDATE training_programs
      SET
        client_id = ?,
        name = ?,
        description = ?
      WHERE id = ?
      `,
      [
        clientId,
        programName,
        programDescription || null,
        programId,
      ]
    );

    return res.json({
      success: true,
      message: "تم تعديل البرنامج بنجاح",
    });
  } catch (error) {
    console.error("PUT /training/:id ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء تعديل البرنامج",
    });
  }
});

/*
==================================================
DELETE /api/training/:id
حذف البرنامج
==================================================
*/
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  let connection;

  try {
    const programId = Number(req.params.id);

    if (!programId || Number.isNaN(programId)) {
      return res.status(400).json({
        success: false,
        message: "رقم البرنامج غير صحيح",
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

    connection = await db.getConnection();

    await connection.beginTransaction();

    const [days] = await connection.query(
      `
      SELECT id
      FROM training_days
      WHERE program_id = ?
      `,
      [programId]
    );

    for (const day of days) {
      await connection.query(
        `
        DELETE FROM exercises
        WHERE day_id = ?
        `,
        [day.id]
      );
    }

    await connection.query(
      `
      DELETE FROM training_days
      WHERE program_id = ?
      `,
      [programId]
    );

    await connection.query(
      `
      DELETE FROM training_programs
      WHERE id = ?
      `,
      [programId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "تم حذف البرنامج وجميع بياناته بنجاح",
    });
  } catch (error) {
    console.error("DELETE /training/:id ERROR:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء حذف البرنامج",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/*
==================================================
POST /api/training/:id/duplicate-to-client/:clientId
نسخ برنامج كامل إلى عميل آخر
==================================================
*/
router.post(
  "/:id/duplicate-to-client/:clientId",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    let connection;

    try {
      const programId = Number(req.params.id);
      const targetClientId = Number(req.params.clientId);

      if (
        !programId ||
        Number.isNaN(programId) ||
        !targetClientId ||
        Number.isNaN(targetClientId)
      ) {
        return res.status(400).json({
          success: false,
          message: "بيانات النسخ غير صحيحة",
        });
      }

      const [sourcePrograms] = await db.query(
        `
        SELECT
          id,
          name,
          description
        FROM training_programs
        WHERE id = ?
        `,
        [programId]
      );

      if (sourcePrograms.length === 0) {
        return res.status(404).json({
          success: false,
          message: "البرنامج غير موجود",
        });
      }

      const [clients] = await db.query(
        `
        SELECT id
        FROM users
        WHERE id = ?
        AND role = 'client'
        LIMIT 1
        `,
        [targetClientId]
      );

      if (clients.length === 0) {
        return res.status(404).json({
          success: false,
          message: "العميل المستهدف غير موجود",
        });
      }

      const source = sourcePrograms[0];

      connection = await db.getConnection();

      await connection.beginTransaction();

      const [newProgram] = await connection.query(
        `
        INSERT INTO training_programs
        (
          client_id,
          name,
          description
        )
        VALUES (?, ?, ?)
        `,
        [
          targetClientId,
          `${source.name || "برنامج تدريبي"} - نسخة`,
          source.description || null,
        ]
      );

      const [days] = await connection.query(
        `
        SELECT
          id,
          day_number,
          name
        FROM training_days
        WHERE program_id = ?
        ORDER BY day_number ASC, id ASC
        `,
        [programId]
      );

      for (const day of days) {
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
            newProgram.insertId,
            day.day_number,
            day.name || `اليوم ${day.day_number}`,
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
          [day.id]
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
      }

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: "تم نسخ البرنامج إلى العميل بنجاح",
        programId: newProgram.insertId,
      });
    } catch (error) {
      console.error(
        "POST /training/:id/duplicate-to-client ERROR:",
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
        message: "تعذر نسخ البرنامج إلى العميل",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

module.exports = router;