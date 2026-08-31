const express = require("express");

const db = require("../config/db");

const {
  verifyToken,
} = require("../middleware/authMiddleware");
const {
  createNotification,
  notifyAdmins,
} = require("../utils/notifications");

const router = express.Router();


/*
====================================================
العميل - إنشاء طلب اشتراك
====================================================
*/

router.post(
  "/",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({
          success: false,
          message:
            "هذه العملية خاصة بالعملاء",
        });
      }

      const clientId = req.user.id;

      const {
        package_id,
      } = req.body;


      /*
      التأكد من اختيار الباقة
      */

      if (!package_id) {
        return res.status(400).json({
          success: false,
          message:
            "يجب اختيار الباقة",
        });
      }


      /*
      التأكد أن الباقة موجودة
      */

      const [packages] =
        await db.query(
          `
          SELECT
            id,
            name,
            price,
            duration_days
          FROM packages
          WHERE id = ?
          LIMIT 1
          `,
          [package_id]
        );


      if (
        packages.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "الباقة غير موجودة",
        });
      }


      /*
      تحديث الاشتراكات المنتهية
      */

      await db.query(
        `
        UPDATE subscriptions
        SET status = 'expired'
        WHERE client_id = ?
        AND status IN ('active', 'paused')
        AND end_date IS NOT NULL
        AND end_date <= NOW()
        `,
        [clientId]
      );


      /*
      التأكد من عدم وجود طلب
      قيد المراجعة
      */

      const [
        pendingSubscriptions,
      ] = await db.query(
        `
        SELECT
          id
        FROM subscriptions
        WHERE client_id = ?
        AND status = 'pending'
        LIMIT 1
        `,
        [clientId]
      );


      if (
        pendingSubscriptions.length >
        0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "لديك طلب اشتراك قيد المراجعة بالفعل",
        });
      }


      /*
      التأكد من عدم وجود
      اشتراك فعال
      */

      const [
        activeSubscriptions,
      ] = await db.query(
        `
        SELECT
          id
        FROM subscriptions
        WHERE client_id = ?
        AND status = 'active'
        AND (
          end_date IS NULL
          OR end_date > NOW()
        )
        LIMIT 1
        `,
        [clientId]
      );


      if (
        activeSubscriptions.length >
        0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "لديك اشتراك نشط بالفعل",
        });
      }


      /*
      التأكد من عدم وجود
      اشتراك موقوف
      */

      const [
        pausedSubscriptions,
      ] = await db.query(
        `
        SELECT
          id
        FROM subscriptions
        WHERE client_id = ?
        AND status = 'paused'
        AND (
          end_date IS NULL
          OR end_date > NOW()
        )
        LIMIT 1
        `,
        [clientId]
      );


      if (
        pausedSubscriptions.length >
        0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "لديك اشتراك موقوف حاليًا، لا يمكنك طلب اشتراك جديد قبل استئناف الاشتراك أو انتهائه",
        });
      }


      /*
      إنشاء طلب الاشتراك
      */

      const [result] =
        await db.query(
          `
          INSERT INTO subscriptions
          (
            client_id,
            package_id,
            status
          )
          VALUES
          (?, ?, 'pending')
          `,
          [
            clientId,
            package_id,
          ]
        );

      // إشعار فوري لكل حسابات المدربين بوجود طلب اشتراك جديد.
      const clientName = req.user.name || "عميل";
      const packageName = packages[0].name || "باقة";

      await notifyAdmins({
        type: "subscription",
        title: "طلب اشتراك جديد",
        message: `${clientName} أرسل طلب اشتراك جديد في ${packageName}`,
        link: "/subscription-requests",
      });

      return res.status(201).json({
        success: true,

        message:
          "تم إرسال طلب الاشتراك بنجاح",

        subscription: {
          id: result.insertId,

          client_id:
            clientId,

          package_id:
            package_id,

          status:
            "pending",
        },
      });

    } catch (error) {
      console.error(
        "Create subscription error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء إنشاء طلب الاشتراك",
      });
    }
  }
);


/*
====================================================
المدرب - جلب جميع طلبات الاشتراك
====================================================
*/

router.get(
  "/admin",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "هذه الصفحة خاصة بالمدرب",
        });
      }


      /*
      تحديث الاشتراكات المنتهية
      */

      await db.query(
        `
        UPDATE subscriptions
        SET status = 'expired'
        WHERE status IN ('active', 'paused')
        AND end_date IS NOT NULL
        AND end_date <= NOW()
        `
      );


      /*
      جلب الاشتراكات
      */

      const [
        subscriptions,
      ] = await db.query(
        `
        SELECT
          s.id,
          s.client_id,
          s.package_id,
          s.status,
          s.start_date,
          s.end_date,
          s.created_at,

          c.name AS client_name,
          c.email AS client_email,

          p.name AS package_name,
          p.price AS package_price,
          p.duration_days

        FROM subscriptions s

        INNER JOIN users c
          ON c.id = s.client_id

        INNER JOIN packages p
          ON p.id = s.package_id

        ORDER BY
          CASE
            WHEN s.status = 'pending'
            THEN 1

            WHEN s.status = 'active'
            THEN 2

            WHEN s.status = 'paused'
            THEN 3

            WHEN s.status = 'rejected'
            THEN 4

            WHEN s.status = 'expired'
            THEN 5

            ELSE 6
          END,

          s.created_at DESC
        `
      );


      return res.json({
        success: true,

        subscriptions:
          subscriptions,
      });

    } catch (error) {
      console.error(
        "Get subscriptions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء جلب طلبات الاشتراك",
      });
    }
  }
);


/*
====================================================
المدرب - قبول الاشتراك
====================================================
*/

router.put(
  "/:id/approve",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "هذه العملية خاصة بالمدرب",
        });
      }


      const subscriptionId =
        Number(req.params.id);


      /*
      التأكد من رقم الاشتراك
      */

      if (
        !Number.isInteger(
          subscriptionId
        ) ||
        subscriptionId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم الاشتراك غير صحيح",
        });
      }


      /*
      جلب الاشتراك والباقة
      */

      const [
        subscriptions,
      ] = await db.query(
        `
        SELECT
          s.id,
          s.client_id,
          s.package_id,
          s.status,
          p.duration_days

        FROM subscriptions s

        INNER JOIN packages p
          ON p.id = s.package_id

        WHERE s.id = ?

        LIMIT 1
        `,
        [subscriptionId]
      );


      if (
        subscriptions.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "طلب الاشتراك غير موجود",
        });
      }


      const subscription =
        subscriptions[0];


      /*
      التأكد أن الطلب معلق
      */

      if (
        subscription.status !==
        "pending"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "لا يمكن قبول هذا الطلب لأن حالته الحالية ليست قيد المراجعة",
        });
      }


      /*
      التأكد من عدم وجود
      اشتراك فعال آخر
      */

      const [
        activeSubscriptions,
      ] = await db.query(
        `
        SELECT
          id
        FROM subscriptions

        WHERE client_id = ?

        AND status = 'active'

        AND (
          end_date IS NULL
          OR end_date > NOW()
        )

        LIMIT 1
        `,
        [
          subscription.client_id,
        ]
      );


      if (
        activeSubscriptions.length >
        0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "هذا العميل لديه اشتراك فعال بالفعل",
        });
      }


      /*
      التأكد من عدم وجود
      اشتراك موقوف
      */

      const [
        pausedSubscriptions,
      ] = await db.query(
        `
        SELECT
          id

        FROM subscriptions

        WHERE client_id = ?

        AND status = 'paused'

        AND (
          end_date IS NULL
          OR end_date > NOW()
        )

        LIMIT 1
        `,
        [
          subscription.client_id,
        ]
      );


      if (
        pausedSubscriptions.length >
        0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "هذا العميل لديه اشتراك موقوف بالفعل",
        });
      }


      /*
      حساب مدة الباقة
      */

      const durationDays =
        Number(
          subscription.duration_days
        );


      if (
        !Number.isFinite(
          durationDays
        ) ||
        durationDays <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "مدة الباقة غير صحيحة",
        });
      }


      /*
      تفعيل الاشتراك
      */

      await db.query(
        `
        UPDATE subscriptions

        SET
          status = 'active',

          start_date = NOW(),

          end_date =
            DATE_ADD(
              NOW(),
              INTERVAL ? DAY
            )

        WHERE id = ?
        `,
        [
          durationDays,
          subscriptionId,
        ]
      );

      await createNotification({
        userId: subscription.client_id,
        type: "subscription_approved",
        title: "تم قبول الاشتراك",
        message: "تم قبول طلب الاشتراك وتفعيله بنجاح",
        link: "/client/subscriptions",
      });

      return res.json({
        success: true,

        message:
          "تم قبول الاشتراك وتفعيله بنجاح",
      });

    } catch (error) {
      console.error(
        "Approve subscription error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء قبول الاشتراك",
      });
    }
  }
);


/*
====================================================
المدرب - رفض الاشتراك
====================================================
*/

router.put(
  "/:id/reject",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "هذه العملية خاصة بالمدرب",
        });
      }


      const subscriptionId =
        Number(req.params.id);


      /*
      التأكد من رقم الاشتراك
      */

      if (
        !Number.isInteger(
          subscriptionId
        ) ||
        subscriptionId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم الاشتراك غير صحيح",
        });
      }


      const [
        subscriptions,
      ] = await db.query(
        `
        SELECT
          id,
          client_id,
          status

        FROM subscriptions

        WHERE id = ?

        LIMIT 1
        `,
        [subscriptionId]
      );


      if (
        subscriptions.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "طلب الاشتراك غير موجود",
        });
      }


      if (
        subscriptions[0].status !==
        "pending"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "لا يمكن رفض هذا الطلب لأن حالته الحالية ليست قيد المراجعة",
        });
      }


      /*
      رفض الاشتراك
      */

      await db.query(
        `
        UPDATE subscriptions

        SET
          status = 'rejected'

        WHERE id = ?
        `,
        [subscriptionId]
      );

      await createNotification({
        userId: subscriptions[0].client_id,
        type: "subscription_rejected",
        title: "تم رفض الاشتراك",
        message: "تم رفض طلب الاشتراك من المدرب",
        link: "/client/subscriptions",
      });

      return res.json({
        success: true,

        message:
          "تم رفض طلب الاشتراك",
      });

    } catch (error) {
      console.error(
        "Reject subscription error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء رفض الاشتراك",
      });
    }
  }
);


/*
====================================================
المدرب - إيقاف الاشتراك مؤقتًا
====================================================
*/

router.put(
  "/:id/pause",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "هذه العملية خاصة بالمدرب",
        });
      }


      const subscriptionId =
        Number(req.params.id);


      /*
      التأكد من رقم الاشتراك
      */

      if (
        !Number.isInteger(
          subscriptionId
        ) ||
        subscriptionId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم الاشتراك غير صحيح",
        });
      }


      /*
      جلب الاشتراك
      */

      const [
        subscriptions,
      ] = await db.query(
        `
        SELECT
          id,
          status,
          end_date

        FROM subscriptions

        WHERE id = ?

        LIMIT 1
        `,
        [subscriptionId]
      );


      if (
        subscriptions.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "الاشتراك غير موجود",
        });
      }


      const subscription =
        subscriptions[0];


      /*
      التأكد من أن الاشتراك فعال
      */

      if (
        subscription.status !==
        "active"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "لا يمكن إيقاف الاشتراك لأن حالته الحالية ليست فعالة",
        });
      }


      /*
      التأكد من أن الاشتراك
      لم ينتهِ
      */

      if (
        subscription.end_date &&
        new Date(
          subscription.end_date
        ).getTime() <= Date.now()
      ) {
        await db.query(
          `
          UPDATE subscriptions

          SET
            status = 'expired'

          WHERE id = ?
          `,
          [subscriptionId]
        );

        return res.status(400).json({
          success: false,
          message:
            "انتهت مدة الاشتراك بالفعل",
        });
      }


      /*
      إيقاف الاشتراك
      */

      await db.query(
        `
        UPDATE subscriptions

        SET
          status = 'paused'

        WHERE id = ?
        `,
        [subscriptionId]
      );


      return res.json({
        success: true,

        message:
          "تم إيقاف الاشتراك مؤقتًا بنجاح",
      });

    } catch (error) {
      console.error(
        "Pause subscription error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء إيقاف الاشتراك",
      });
    }
  }
);


/*
====================================================
المدرب - استئناف الاشتراك
====================================================
*/

router.put(
  "/:id/resume",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "هذه العملية خاصة بالمدرب",
        });
      }


      const subscriptionId =
        Number(req.params.id);


      /*
      التأكد من رقم الاشتراك
      */

      if (
        !Number.isInteger(
          subscriptionId
        ) ||
        subscriptionId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم الاشتراك غير صحيح",
        });
      }


      /*
      جلب الاشتراك
      */

      const [
        subscriptions,
      ] = await db.query(
        `
        SELECT
          id,
          status,
          end_date

        FROM subscriptions

        WHERE id = ?

        LIMIT 1
        `,
        [subscriptionId]
      );


      if (
        subscriptions.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "الاشتراك غير موجود",
        });
      }


      const subscription =
        subscriptions[0];


      /*
      التأكد من أن الاشتراك موقوف
      */

      if (
        subscription.status !==
        "paused"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "لا يمكن استئناف الاشتراك لأن حالته الحالية ليست موقوفة",
        });
      }


      /*
      التأكد أن تاريخ النهاية
      لم ينتهِ
      */

      if (
        subscription.end_date &&
        new Date(
          subscription.end_date
        ).getTime() <= Date.now()
      ) {
        await db.query(
          `
          UPDATE subscriptions

          SET
            status = 'expired'

          WHERE id = ?
          `,
          [subscriptionId]
        );

        return res.status(400).json({
          success: false,
          message:
            "انتهت مدة الاشتراك ولا يمكن استئنافه",
        });
      }


      /*
      استئناف الاشتراك
      */

      await db.query(
        `
        UPDATE subscriptions

        SET
          status = 'active'

        WHERE id = ?
        `,
        [subscriptionId]
      );


      return res.json({
        success: true,

        message:
          "تم استئناف الاشتراك بنجاح",
      });

    } catch (error) {
      console.error(
        "Resume subscription error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء استئناف الاشتراك",
      });
    }
  }
);


/*
====================================================
العميل - جلب اشتراكه الحالي
====================================================
*/

router.get(
  "/my",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({
          success: false,
          message:
            "هذه الصفحة خاصة بالعملاء",
        });
      }


      const clientId =
        req.user.id;


      /*
      تحديث الاشتراكات المنتهية
      */

      await db.query(
        `
        UPDATE subscriptions

        SET
          status = 'expired'

        WHERE client_id = ?

        AND status IN (
          'active',
          'paused'
        )

        AND end_date IS NOT NULL

        AND end_date <= NOW()
        `,
        [clientId]
      );


      /*
      جلب آخر اشتراك
      */

      const [
        subscriptions,
      ] = await db.query(
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

        ORDER BY
          s.created_at DESC

        LIMIT 1
        `,
        [clientId]
      );


      return res.json({
        success: true,

        subscription:
          subscriptions.length >
          0
            ? subscriptions[0]
            : null,
      });

    } catch (error) {
      console.error(
        "Get my subscription error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء جلب الاشتراك",
      });
    }
  }
);


module.exports = router;