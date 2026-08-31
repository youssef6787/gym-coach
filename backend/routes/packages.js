const express = require("express");

const db = require("../config/db");

const {
  verifyToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
=========================================================
GET /api/packages
جلب الباقات
=========================================================

إذا كان الطلب من صفحة العميل:
يمكن للواجهة استخدام is_active لإظهار الباقات المتاحة فقط.

أما المدرب فيحتاج رؤية جميع الباقات، بما فيها المخفية.
*/

router.get("/", async (req, res) => {
  try {
    const [packages] = await db.query(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.duration_days,
        p.is_active,
        p.is_featured,
        p.features,

        (
          SELECT COUNT(DISTINCT s.client_id)
          FROM subscriptions s
          WHERE s.package_id = p.id
          AND s.status = 'active'
          AND (
            s.end_date IS NULL
            OR s.end_date > NOW()
          )
        ) AS active_subscribers,

        (
          SELECT COUNT(*)
          FROM subscriptions s
          WHERE s.package_id = p.id
        ) AS total_subscriptions

      FROM packages p

      ORDER BY
        p.is_featured DESC,
        p.id DESC
    `);

    res.json({
      success: true,
      packages,
    });
  } catch (error) {
    console.error(
      "Get packages error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب الباقات",
    });
  }
});


/*
=========================================================
POST /api/packages
إضافة باقة جديدة
=========================================================
*/

router.post(
  "/",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        name,
        description,
        price,
        duration_days,
        is_active,
        is_featured,
        features,
      } = req.body;

      /*
      التحقق
      */

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "اسم الباقة مطلوب",
        });
      }

      const numericPrice =
        Number(price);

      const numericDuration =
        Number(duration_days);

      if (
        !Number.isFinite(numericPrice) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "السعر غير صحيح",
        });
      }

      if (
        !Number.isFinite(numericDuration) ||
        numericDuration <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "مدة الباقة غير صحيحة",
        });
      }

      /*
      إذا كانت هذه الباقة مميزة،
      نلغي المميز من باقي الباقات.
      */

      if (Boolean(is_featured)) {
        await db.query(`
          UPDATE packages
          SET is_featured = 0
        `);
      }

      const [result] =
        await db.query(
          `
          INSERT INTO packages
          (
            name,
            description,
            price,
            duration_days,
            is_active,
            is_featured,
            features
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            name.trim(),
            description
              ? description.trim()
              : null,

            numericPrice,

            numericDuration,

            is_active === false
              ? 0
              : 1,

            is_featured
              ? 1
              : 0,

            features
              ? String(features).trim()
              : null,
          ]
        );

      res.status(201).json({
        success: true,
        message: "تمت إضافة الباقة بنجاح",
        packageId: result.insertId,
      });
    } catch (error) {
      console.error(
        "Create package error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء إضافة الباقة",
      });
    }
  }
);


/*
=========================================================
PUT /api/packages/:id
تعديل باقة
=========================================================
*/

router.put(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const {
        name,
        description,
        price,
        duration_days,
        is_active,
        is_featured,
        features,
      } = req.body;

      const packageId =
        Number(id);

      if (
        !Number.isInteger(packageId) ||
        packageId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "رقم الباقة غير صحيح",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "اسم الباقة مطلوب",
        });
      }

      const numericPrice =
        Number(price);

      const numericDuration =
        Number(duration_days);

      if (
        !Number.isFinite(numericPrice) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "السعر غير صحيح",
        });
      }

      if (
        !Number.isFinite(numericDuration) ||
        numericDuration <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "مدة الباقة غير صحيحة",
        });
      }

      /*
      إذا أصبحت الباقة مميزة،
      نزيل المميز من باقي الباقات.
      */

      if (Boolean(is_featured)) {
        await db.query(
          `
          UPDATE packages
          SET is_featured = 0
          WHERE id <> ?
          `,
          [packageId]
        );
      }

      const [result] =
        await db.query(
          `
          UPDATE packages
          SET
            name = ?,
            description = ?,
            price = ?,
            duration_days = ?,
            is_active = ?,
            is_featured = ?,
            features = ?
          WHERE id = ?
          `,
          [
            name.trim(),

            description
              ? description.trim()
              : null,

            numericPrice,

            numericDuration,

            is_active === false
              ? 0
              : 1,

            is_featured
              ? 1
              : 0,

            features
              ? String(features).trim()
              : null,

            packageId,
          ]
        );

      if (
        result.affectedRows === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "الباقة غير موجودة",
        });
      }

      res.json({
        success: true,
        message: "تم تعديل الباقة بنجاح",
      });
    } catch (error) {
      console.error(
        "Update package error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تعديل الباقة",
      });
    }
  }
);


/*
=========================================================
PATCH /api/packages/:id/toggle
إظهار / إخفاء الباقة
=========================================================
*/

router.patch(
  "/:id/toggle",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const packageId =
        Number(req.params.id);

      if (
        !Number.isInteger(packageId) ||
        packageId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "رقم الباقة غير صحيح",
        });
      }

      const [packages] =
        await db.query(
          `
          SELECT
            id,
            is_active
          FROM packages
          WHERE id = ?
          LIMIT 1
          `,
          [packageId]
        );

      if (packages.length === 0) {
        return res.status(404).json({
          success: false,
          message: "الباقة غير موجودة",
        });
      }

      const newStatus =
        packages[0].is_active
          ? 0
          : 1;

      await db.query(
        `
        UPDATE packages
        SET is_active = ?
        WHERE id = ?
        `,
        [
          newStatus,
          packageId,
        ]
      );

      res.json({
        success: true,
        message: newStatus
          ? "تم إظهار الباقة للعملاء"
          : "تم إخفاء الباقة عن العملاء",

        is_active:
          Boolean(newStatus),
      });
    } catch (error) {
      console.error(
        "Toggle package error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء تغيير حالة الباقة",
      });
    }
  }
);


/*
=========================================================
PATCH /api/packages/:id/featured
تحديد / إلغاء الباقة المميزة
=========================================================
*/

router.patch(
  "/:id/featured",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const packageId =
        Number(req.params.id);

      if (
        !Number.isInteger(packageId) ||
        packageId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "رقم الباقة غير صحيح",
        });
      }

      const [packages] =
        await db.query(
          `
          SELECT
            id,
            is_featured
          FROM packages
          WHERE id = ?
          LIMIT 1
          `,
          [packageId]
        );

      if (packages.length === 0) {
        return res.status(404).json({
          success: false,
          message: "الباقة غير موجودة",
        });
      }

      const currentlyFeatured =
        Boolean(
          packages[0].is_featured
        );

      /*
      إلغاء المميز من الجميع
      */

      await db.query(`
        UPDATE packages
        SET is_featured = 0
      `);

      /*
      إذا لم تكن مميزة،
      نجعلها المميزة.
      */

      if (!currentlyFeatured) {
        await db.query(
          `
          UPDATE packages
          SET is_featured = 1
          WHERE id = ?
          `,
          [packageId]
        );
      }

      res.json({
        success: true,
        message:
          !currentlyFeatured
            ? "تم تحديد الباقة كباقة مميزة"
            : "تم إلغاء الباقة المميزة",
      });
    } catch (error) {
      console.error(
        "Toggle featured package error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء تغيير الباقة المميزة",
      });
    }
  }
);


/*
=========================================================
DELETE /api/packages/:id
حذف الباقة
=========================================================
*/

router.delete(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const packageId =
        Number(req.params.id);

      if (
        !Number.isInteger(packageId) ||
        packageId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "رقم الباقة غير صحيح",
        });
      }

      /*
      لا نحذف باقة مرتبطة باشتراكات
      حتى لا نخرب السجل التاريخي.
      */

      const [subscriptions] =
        await db.query(
          `
          SELECT COUNT(*) AS total
          FROM subscriptions
          WHERE package_id = ?
          `,
          [packageId]
        );

      const totalSubscriptions =
        Number(
          subscriptions[0]?.total || 0
        );

      if (totalSubscriptions > 0) {
        return res.status(400).json({
          success: false,
          message:
            "لا يمكن حذف هذه الباقة لأنها مرتبطة باشتراكات. يمكنك إخفاؤها بدلًا من حذفها.",
        });
      }

      const [result] =
        await db.query(
          `
          DELETE FROM packages
          WHERE id = ?
          `,
          [packageId]
        );

      if (
        result.affectedRows === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "الباقة غير موجودة",
        });
      }

      res.json({
        success: true,
        message: "تم حذف الباقة بنجاح",
      });
    } catch (error) {
      console.error(
        "Delete package error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء حذف الباقة",
      });
    }
  }
);


module.exports = router;