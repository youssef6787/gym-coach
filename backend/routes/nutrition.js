const express = require("express");

const db = require("../config/db");

const {
  verifyToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
========================================
المدرب - إنشاء نظام غذائي للعميل
========================================
*/

router.post(
  "/",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        client_id,
        name,
        description,
        meals,
      } = req.body;

      if (!client_id) {
        return res.status(400).json({
          success: false,
          message: "يجب اختيار العميل",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "يجب كتابة اسم النظام الغذائي",
        });
      }

      if (!Array.isArray(meals) || meals.length === 0) {
        return res.status(400).json({
          success: false,
          message: "يجب إضافة وجبة واحدة على الأقل",
        });
      }

      /*
      ========================================
      التأكد من وجود العميل
      ========================================
      */

      const [clients] = await db.query(
        `
        SELECT
          id
        FROM users
        WHERE id = ?
        AND role = 'client'
        LIMIT 1
        `,
        [client_id]
      );

      if (clients.length === 0) {
        return res.status(404).json({
          success: false,
          message: "العميل غير موجود",
        });
      }

      /*
      ========================================
      إنشاء النظام الغذائي
      ========================================
      */

      const [planResult] = await db.query(
        `
        INSERT INTO nutrition_plans
        (
          client_id,
          name,
          description
        )
        VALUES (?, ?, ?)
        `,
        [
          client_id,
          name.trim(),
          description
            ? description.trim()
            : null
        ]
      );

      const nutritionPlanId =
        planResult.insertId;

      /*
      ========================================
      إضافة الوجبات
      ========================================
      */

      for (
        let index = 0;
        index < meals.length;
        index++
      ) {
        const meal = meals[index];

        await db.query(
          `
          INSERT INTO nutrition_meals
          (
            nutrition_plan_id,
            name,
            description,
            calories,
            protein,
            carbs,
            fats,
            meal_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            nutritionPlanId,

            meal.name
              ? meal.name.trim()
              : "",

            meal.description
              ? meal.description.trim()
              : null,

            meal.calories !== ""
              ? meal.calories
              : null,

            meal.protein !== ""
              ? meal.protein
              : null,

            meal.carbs !== ""
              ? meal.carbs
              : null,

            meal.fats !== ""
              ? meal.fats
              : null,

            index + 1,
          ]
        );
      }

      return res.status(201).json({
        success: true,
        message:
          "تم حفظ النظام الغذائي للعميل بنجاح",
        nutritionPlanId,
      });
    } catch (error) {
      console.error(
        "Nutrition create error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء حفظ النظام الغذائي",
      });
    }
  }
);


/*
========================================
الأدمن - جلب جميع الأنظمة الغذائية
========================================
*/

router.get(
  "/admin",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const [plans] = await db.query(
        `
        SELECT
          np.id,
          np.client_id,
          np.name,
          np.description,
          np.created_at,

          u.name AS client_name,
          u.email AS client_email

        FROM nutrition_plans np

        INNER JOIN users u
          ON u.id = np.client_id

        ORDER BY np.id DESC
        `
      );

      return res.json({
        success: true,
        plans: plans || [],
      });
    } catch (error) {
      console.error(
        "Admin nutrition fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء جلب الأنظمة الغذائية",
      });
    }
  }
);


/*
========================================
العميل - جلب النظام الغذائي الخاص به
========================================

مهم جدًا:

هذا المسار يجب أن يكون قبل /:id

حتى لا يعتبر Express كلمة my-diet
رقمًا أو ID للنظام الغذائي.

ولا يتم إرسال النظام الغذائي للعميل
إلا إذا كان لديه اشتراك فعال وساري.

شروط الاشتراك الفعال:

status = active

و:

end_date IS NULL
أو
end_date > NOW()

========================================
*/

router.get(
  "/my-diet",
  verifyToken,
  async (req, res) => {
    try {
      /*
      ========================================
      التأكد أن المستخدم عميل
      ========================================
      */

      if (req.user.role !== "client") {
        return res.status(403).json({
          success: false,
          message:
            "هذه الصفحة خاصة بالعملاء",
        });
      }

      const clientId = req.user.id;

      /*
      ========================================
      تحديث الاشتراكات المنتهية
      ========================================
      */

      await db.query(
        `
        UPDATE subscriptions

        SET status = 'expired'

        WHERE client_id = ?

        AND status = 'active'

        AND end_date IS NOT NULL

        AND end_date <= NOW()
        `,
        [clientId]
      );

      /*
      ========================================
      التحقق من وجود اشتراك فعال
      ========================================
      */

      const [activeSubscriptions] =
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

          INNER JOIN packages p
            ON p.id = s.package_id

          WHERE s.client_id = ?

          AND s.status = 'active'

          AND (
            s.end_date IS NULL
            OR s.end_date > NOW()
          )

          ORDER BY s.id DESC

          LIMIT 1
          `,
          [clientId]
        );

      /*
      ========================================
      لا يوجد اشتراك فعال
      ========================================
      */

      if (activeSubscriptions.length === 0) {
        return res.json({
          success: true,
          diet: null,
          hasActiveSubscription: false,
          subscription: null,
          message:
            "يجب أن يكون لديك اشتراك فعال للوصول إلى النظام الغذائي",
        });
      }

      const activeSubscription =
        activeSubscriptions[0];

      /*
      ========================================
      جلب آخر نظام غذائي للعميل
      ========================================
      */

      const [plans] = await db.query(
        `
        SELECT
          id,
          client_id,
          name,
          description,
          created_at

        FROM nutrition_plans

        WHERE client_id = ?

        ORDER BY id DESC

        LIMIT 1
        `,
        [clientId]
      );

      /*
      ========================================
      لا يوجد نظام غذائي
      ========================================
      */

      if (plans.length === 0) {
        return res.json({
          success: true,
          diet: null,
          hasActiveSubscription: true,
          subscription:
            activeSubscription,
          message:
            "لا يوجد نظام غذائي مخصص لك حتى الآن",
        });
      }

      const diet = plans[0];

      /*
      ========================================
      جلب الوجبات
      ========================================
      */

      const [meals] = await db.query(
        `
        SELECT
          id,
          nutrition_plan_id,
          name,
          description,
          calories,
          protein,
          carbs,
          fats,
          meal_order

        FROM nutrition_meals

        WHERE nutrition_plan_id = ?

        ORDER BY
          meal_order ASC,
          id ASC
        `,
        [diet.id]
      );

      diet.meals = meals || [];

      /*
      ========================================
      إرسال النظام الغذائي
      ========================================
      */

      return res.json({
        success: true,
        diet,
        hasActiveSubscription: true,
        subscription:
          activeSubscription,
      });
    } catch (error) {
      console.error(
        "Nutrition client fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء جلب النظام الغذائي",
      });
    }
  }
);


/*
========================================
الأدمن - فتح نظام غذائي محدد
========================================

هذا المسار بعد /my-diet عمدًا.

========================================
*/

router.get(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const planId =
        Number(req.params.id);

      if (
        !planId ||
        Number.isNaN(planId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم النظام الغذائي غير صحيح",
        });
      }

      /*
      ========================================
      جلب النظام
      ========================================
      */

      const [plans] =
        await db.query(
          `
          SELECT
            np.id,
            np.client_id,
            np.name,
            np.description,
            np.created_at,

            u.name AS client_name,
            u.email AS client_email

          FROM nutrition_plans np

          INNER JOIN users u
            ON u.id = np.client_id

          WHERE np.id = ?

          LIMIT 1
          `,
          [planId]
        );

      if (plans.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "النظام الغذائي غير موجود",
        });
      }

      const plan = plans[0];

      /*
      ========================================
      جلب الوجبات
      ========================================
      */

      const [meals] =
        await db.query(
          `
          SELECT
            id,
            nutrition_plan_id,
            name,
            description,
            calories,
            protein,
            carbs,
            fats,
            meal_order

          FROM nutrition_meals

          WHERE nutrition_plan_id = ?

          ORDER BY
            meal_order ASC,
            id ASC
          `,
          [planId]
        );

      plan.meals = meals || [];

      return res.json({
        success: true,
        plan,
      });
    } catch (error) {
      console.error(
        "Admin nutrition single fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء فتح النظام الغذائي",
      });
    }
  }
);


/*
========================================
الأدمن - تعديل نظام غذائي
========================================
*/

router.put(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    let connection;

    try {
      const planId =
        Number(req.params.id);

      const {
        client_id,
        name,
        description,
        meals,
      } = req.body;

      if (
        !planId ||
        Number.isNaN(planId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم النظام الغذائي غير صحيح",
        });
      }

      if (!client_id) {
        return res.status(400).json({
          success: false,
          message:
            "يجب اختيار العميل",
        });
      }

      if (
        !name ||
        !name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "يجب كتابة اسم النظام الغذائي",
        });
      }

      if (
        !Array.isArray(meals) ||
        meals.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "يجب إضافة وجبة واحدة على الأقل",
        });
      }

      connection =
        await db.getConnection();

      /*
      ========================================
      التأكد من العميل
      ========================================
      */

      const [clients] =
        await connection.query(
          `
          SELECT
            id

          FROM users

          WHERE id = ?

          AND role = 'client'

          LIMIT 1
          `,
          [client_id]
        );

      if (clients.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "العميل غير موجود",
        });
      }

      /*
      ========================================
      التأكد من النظام
      ========================================
      */

      const [plans] =
        await connection.query(
          `
          SELECT
            id

          FROM nutrition_plans

          WHERE id = ?

          LIMIT 1
          `,
          [planId]
        );

      if (plans.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "النظام الغذائي غير موجود",
        });
      }

      await connection.beginTransaction();

      /*
      ========================================
      تحديث بيانات النظام
      ========================================
      */

      await connection.query(
        `
        UPDATE nutrition_plans

        SET
          client_id = ?,
          name = ?,
          description = ?

        WHERE id = ?
        `,
        [
          client_id,
          name.trim(),
          description
            ? description.trim()
            : null,
          planId,
        ]
      );

      /*
      ========================================
      حذف الوجبات القديمة
      ========================================
      */

      await connection.query(
        `
        DELETE FROM nutrition_meals

        WHERE nutrition_plan_id = ?
        `,
        [planId]
      );

      /*
      ========================================
      إضافة الوجبات الجديدة
      ========================================
      */

      let mealOrder = 1;

      for (const meal of meals) {
        if (
          !meal.name ||
          !meal.name.trim()
        ) {
          continue;
        }

        await connection.query(
          `
          INSERT INTO nutrition_meals
          (
            nutrition_plan_id,
            name,
            description,
            calories,
            protein,
            carbs,
            fats,
            meal_order
          )

          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            planId,

            meal.name.trim(),

            meal.description
              ? meal.description.trim()
              : null,

            meal.calories !== "" &&
            meal.calories != null
              ? meal.calories
              : null,

            meal.protein !== "" &&
            meal.protein != null
              ? meal.protein
              : null,

            meal.carbs !== "" &&
            meal.carbs != null
              ? meal.carbs
              : null,

            meal.fats !== "" &&
            meal.fats != null
              ? meal.fats
              : null,

            mealOrder,
          ]
        );

        mealOrder++;
      }

      await connection.commit();

      return res.json({
        success: true,
        message:
          "تم تعديل النظام الغذائي بنجاح",
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Nutrition update rollback error:",
            rollbackError
          );
        }
      }

      console.error(
        "Nutrition update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء تعديل النظام الغذائي",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);


/*
========================================
الأدمن - حذف نظام غذائي
========================================
*/

router.delete(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    let connection;

    try {
      const planId =
        Number(req.params.id);

      if (
        !planId ||
        Number.isNaN(planId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم النظام الغذائي غير صحيح",
        });
      }

      connection =
        await db.getConnection();

      /*
      ========================================
      التأكد من وجود النظام
      ========================================
      */

      const [plans] =
        await connection.query(
          `
          SELECT
            id

          FROM nutrition_plans

          WHERE id = ?

          LIMIT 1
          `,
          [planId]
        );

      if (plans.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "النظام الغذائي غير موجود",
        });
      }

      await connection.beginTransaction();

      /*
      ========================================
      حذف الوجبات
      ========================================
      */

      await connection.query(
        `
        DELETE FROM nutrition_meals

        WHERE nutrition_plan_id = ?
        `,
        [planId]
      );

      /*
      ========================================
      حذف النظام
      ========================================
      */

      await connection.query(
        `
        DELETE FROM nutrition_plans

        WHERE id = ?
        `,
        [planId]
      );

      await connection.commit();

      return res.json({
        success: true,
        message:
          "تم حذف النظام الغذائي وجميع وجباته بنجاح",
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Nutrition delete rollback error:",
            rollbackError
          );
        }
      }

      console.error(
        "Nutrition delete error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء حذف النظام الغذائي",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);


/*
========================================
الأدمن - نسخ نظام غذائي إلى عميل آخر
POST /api/nutrition/:id/duplicate-to-client/:clientId
========================================
*/

router.post(
  "/:id/duplicate-to-client/:clientId",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    let connection;

    try {
      const planId =
        Number(req.params.id);

      const targetClientId =
        Number(req.params.clientId);

      if (
        !planId ||
        Number.isNaN(planId) ||
        !targetClientId ||
        Number.isNaN(targetClientId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "بيانات النسخ غير صحيحة",
        });
      }

      const [plans] =
        await db.query(
          `
          SELECT
            id,
            name,
            description
          FROM nutrition_plans
          WHERE id = ?
          `,
          [planId]
        );

      if (plans.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "النظام الغذائي غير موجود",
        });
      }

      const [clients] =
        await db.query(
          `
          SELECT
            id
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
          message:
            "العميل المستهدف غير موجود",
        });
      }

      const source =
        plans[0];

      const [meals] =
        await db.query(
          `
          SELECT
            name,
            description,
            calories,
            protein,
            carbs,
            fats,
            meal_order
          FROM nutrition_meals
          WHERE nutrition_plan_id = ?
          ORDER BY
            meal_order ASC,
            id ASC
          `,
          [planId]
        );

      connection =
        await db.getConnection();

      await connection.beginTransaction();

      const [newPlan] =
        await connection.query(
          `
          INSERT INTO nutrition_plans
          (
            client_id,
            name,
            description
          )
          VALUES (?, ?, ?)
          `,
          [
            targetClientId,
            `${source.name || "نظام غذائي"} - نسخة`,
            source.description || null,
          ]
        );

      for (const meal of meals) {
        await connection.query(
          `
          INSERT INTO nutrition_meals
          (
            nutrition_plan_id,
            name,
            description,
            calories,
            protein,
            carbs,
            fats,
            meal_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            newPlan.insertId,
            meal.name,
            meal.description || null,
            meal.calories ?? null,
            meal.protein ?? null,
            meal.carbs ?? null,
            meal.fats ?? null,
            meal.meal_order || 1,
          ]
        );
      }

      await connection.commit();

      return res.status(201).json({
        success: true,
        message:
          "تم نسخ النظام الغذائي إلى العميل بنجاح",
        nutritionPlanId:
          newPlan.insertId,
      });
    } catch (error) {
      console.error(
        "POST /nutrition/:id/duplicate-to-client ERROR:",
        error
      );

      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {}
      }

      return res.status(500).json({
        success: false,
        message:
          "تعذر نسخ النظام الغذائي إلى العميل",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

module.exports = router;