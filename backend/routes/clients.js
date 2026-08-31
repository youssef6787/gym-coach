const express = require("express");

const db = require("../config/db");

const {
  verifyToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
==================================================
جلب قائمة العملاء مع آخر اشتراك
==================================================
*/

router.get(
  "/",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const [clients] = await db.query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,

          s.id AS subscription_id,
          s.status AS subscription_status,
          s.start_date,
          s.end_date,

          p.name AS package_name,
          p.price AS package_price,
          p.duration_days

        FROM users u

        LEFT JOIN subscriptions s
          ON s.id = (
            SELECT s2.id
            FROM subscriptions s2
            WHERE s2.client_id = u.id
            ORDER BY s2.created_at DESC, s2.id DESC
            LIMIT 1
          )

        LEFT JOIN packages p
          ON p.id = s.package_id

        WHERE u.role = 'client'

        ORDER BY u.id DESC
        `
      );

      const normalizedClients = clients.map((client) => {
        let subscriptionStatus =
          client.subscription_status || null;

        if (
          subscriptionStatus === "active" &&
          client.end_date &&
          new Date(client.end_date).getTime() <= Date.now()
        ) {
          subscriptionStatus = "expired";
        }

        return {
          ...client,

          subscription_status:
            subscriptionStatus,

          has_active_subscription:
            subscriptionStatus === "active",
        };
      });

      res.json({
        success: true,
        clients: normalizedClients,
      });
    } catch (error) {
      console.error(
        "Get clients error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء جلب العملاء",
      });
    }
  }
);


/*
==================================================
ملف العميل الكامل
GET /api/clients/:id/details
==================================================
*/

router.get(
  "/:id/details",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const clientId = Number(req.params.id);

      if (
        !Number.isInteger(clientId) ||
        clientId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم العميل غير صحيح",
        });
      }

      /*
      ==============================================
      بيانات العميل
      ==============================================
      */

      const [users] = await db.query(
        `
        SELECT
          id,
          name,
          email,
          phone,
          role,
          created_at
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [clientId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "العميل غير موجود",
        });
      }

      const client = users[0];

      if (client.role !== "client") {
        return res.status(400).json({
          success: false,
          message:
            "هذا الحساب ليس عميلاً",
        });
      }


      /*
      ==============================================
      الاشتراك الحالي
      ==============================================
      */

      const [currentSubscriptions] =
        await db.query(
          `
          SELECT
            s.id,
            s.client_id,
            s.package_id,
            s.status,
            s.start_date,
            s.end_date,
            s.created_at,

            p.name AS package_name,
            p.price AS package_price,
            p.duration_days

          FROM subscriptions s

          LEFT JOIN packages p
            ON p.id = s.package_id

          WHERE s.client_id = ?

          ORDER BY
            s.created_at DESC,
            s.id DESC

          LIMIT 1
          `,
          [clientId]
        );


      const currentSubscription =
        currentSubscriptions.length > 0
          ? currentSubscriptions[0]
          : null;


      /*
      ==============================================
      حساب حالة الاشتراك الحالية
      ==============================================
      */

      if (
        currentSubscription &&
        currentSubscription.status === "active" &&
        currentSubscription.end_date &&
        new Date(
          currentSubscription.end_date
        ).getTime() <= Date.now()
      ) {
        currentSubscription.status =
          "expired";
      }


      /*
      ==============================================
      سجل الاشتراكات بالكامل
      ==============================================
      */

      const [subscriptions] =
        await db.query(
          `
          SELECT
            s.id,
            s.client_id,
            s.package_id,
            s.status,
            s.start_date,
            s.end_date,
            s.created_at,

            p.name AS package_name,
            p.price AS package_price,
            p.duration_days

          FROM subscriptions s

          LEFT JOIN packages p
            ON p.id = s.package_id

          WHERE s.client_id = ?

          ORDER BY
            s.created_at DESC,
            s.id DESC
          `,
          [clientId]
        );


      /*
      ==============================================
      البرامج التدريبية
      ==============================================
      */

      const [programs] =
        await db.query(
          `
          SELECT *
          FROM training_programs
          WHERE client_id = ?
          ORDER BY id DESC
          `,
          [clientId]
        );


      /*
      ==============================================
      الأيام والتمارين
      ==============================================
      */

      for (const program of programs) {
        const [days] =
          await db.query(
            `
            SELECT *
            FROM training_days
            WHERE program_id = ?
            ORDER BY day_number ASC, id ASC
            `,
            [program.id]
          );

        program.days = days;

        for (const day of program.days) {
          const [exercises] =
            await db.query(
              `
              SELECT *
              FROM exercises
              WHERE day_id = ?
              ORDER BY exercise_order ASC, id ASC
              `,
              [day.id]
            );

          day.exercises =
            exercises;
        }
      }


      /*
      ==============================================
      تقدم العميل
      ==============================================
      */

      const [progress] =
        await db.query(
          `
          SELECT *
          FROM exercise_progress
          WHERE client_id = ?
          ORDER BY id DESC
          `,
          [clientId]
        );


      /*
      ==============================================
      الأنظمة الغذائية
      ==============================================
      */

      const [nutritionPlans] =
        await db.query(
          `
          SELECT *
          FROM nutrition_plans
          WHERE client_id = ?
          ORDER BY id DESC
          `,
          [clientId]
        );


      /*
      ==============================================
      وجبات النظام الغذائي
      ==============================================
      */

      for (
        const nutritionPlan
        of nutritionPlans
      ) {
        const [meals] =
          await db.query(
            `
            SELECT *
            FROM nutrition_meals
            WHERE nutrition_plan_id = ?
            ORDER BY id ASC
            `,
            [nutritionPlan.id]
          );

        nutritionPlan.meals =
          meals;
      }


      /*
      ==============================================
      إحصائيات العميل
      ==============================================
      */

      let totalExercises = 0;

      let completedExercises = 0;

      programs.forEach(
        (program) => {
          (program.days || []).forEach(
            (day) => {
              totalExercises +=
                (day.exercises || []).length;
            }
          );
        }
      );


      completedExercises =
        progress.filter(
          (item) =>
            Boolean(item.completed)
        ).length;


      const progressPercentage =
        totalExercises > 0
          ? Math.round(
              (completedExercises /
                totalExercises) *
                100
            )
          : 0;


      /*
      ==============================================
      إرسال الملف الكامل
      ==============================================
      */

      res.json({
        success: true,

        client,

        subscription:
          currentSubscription,

        currentSubscription,

        subscriptions,

        programs,

        nutritionPlans,

        progress,

        stats: {
          totalExercises,
          completedExercises,
          progressPercentage,

          totalPrograms:
            programs.length,

          totalNutritionPlans:
            nutritionPlans.length,

          totalSubscriptions:
            subscriptions.length,
        },
      });
    } catch (error) {
      console.error(
        "Client details error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء تحميل ملف العميل",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);


/*
==================================================
حذف عميل
==================================================
*/

/*
==================================================
حذف عميل نهائيًا مع جميع بياناته المرتبطة
==================================================
*/

router.delete(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const clientId = Number(req.params.id);

      if (
        !Number.isInteger(clientId) ||
        clientId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "رقم العميل غير صحيح",
        });
      }

      await connection.beginTransaction();

      /*
      ==============================================
      التأكد من وجود العميل
      ==============================================
      */

      const [users] = await connection.query(
        `
        SELECT
          id,
          email,
          role
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [clientId]
      );

      if (users.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: "العميل غير موجود",
        });
      }

      if (users[0].role !== "client") {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            "لا يمكن حذف هذا الحساب من صفحة العملاء",
        });
      }

      /*
      ==============================================
      تنظيف OTP الخاصة بالعميل
      ==============================================
      */

      await connection.query(
        `
        DELETE FROM auth_otps
        WHERE user_id = ?
        `,
        [clientId]
      );

      /*
      ==============================================
      حذف بيانات التدريب
      ==============================================
      */

      await connection.query(
        `
        DELETE FROM exercise_progress
        WHERE client_id = ?
        `,
        [clientId]
      );

      await connection.query(
        `
        DELETE FROM exercises
        WHERE day_id IN (
          SELECT id
          FROM training_days
          WHERE program_id IN (
            SELECT id
            FROM training_programs
            WHERE client_id = ?
          )
        )
        `,
        [clientId]
      );

      await connection.query(
        `
        DELETE FROM training_days
        WHERE program_id IN (
          SELECT id
          FROM training_programs
          WHERE client_id = ?
        )
        `,
        [clientId]
      );

      await connection.query(
        `
        DELETE FROM training_programs
        WHERE client_id = ?
        `,
        [clientId]
      );

      /*
      ==============================================
      حذف بيانات التغذية
      ==============================================
      */

      await connection.query(
        `
        DELETE FROM nutrition_meals
        WHERE nutrition_plan_id IN (
          SELECT id
          FROM nutrition_plans
          WHERE client_id = ?
        )
        `,
        [clientId]
      );

      await connection.query(
        `
        DELETE FROM nutrition_plans
        WHERE client_id = ?
        `,
        [clientId]
      );

      /*
      ==============================================
      حذف الاشتراكات
      ==============================================
      */

      await connection.query(
        `
        DELETE FROM subscriptions
        WHERE client_id = ?
        `,
        [clientId]
      );

      /*
      ==============================================
      حذف الرسائل
      ==============================================
      */

      await connection.query(
        `
        DELETE FROM messages
        WHERE sender_id = ?
           OR receiver_id = ?
        `,
        [clientId, clientId]
      );

      /*
      ==============================================
      حذف الإشعارات
      ==============================================
      */

      await connection.query(
        `
        DELETE FROM notifications
        WHERE user_id = ?
        `,
        [clientId]
      );

      /*
      ==============================================
      حذف المستخدم نفسه
      ==============================================
      */

      const [deleteResult] =
        await connection.query(
          `
          DELETE FROM users
          WHERE id = ?
            AND role = 'client'
          `,
          [clientId]
        );

      /*
      ==============================================
      التأكد من أن المستخدم حُذف فعليًا
      ==============================================
      */

      if (deleteResult.affectedRows !== 1) {
        throw new Error(
          "لم يتم حذف العميل من جدول users"
        );
      }

      await connection.commit();

      return res.json({
        success: true,
        message:
          "تم حذف العميل وجميع بياناته المرتبطة بنجاح",
        deletedClientId: clientId,
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Rollback error:",
          rollbackError
        );
      }

      console.error(
        "Delete client error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "تعذر حذف العميل. لم يتم إجراء أي حذف جزئي.",
      });
    } finally {
      connection.release();
    }
  }
);


module.exports = router;