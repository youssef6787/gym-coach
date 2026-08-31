const express = require("express");

const db = require("../config/db");

const {
  verifyToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();


/*
=========================================================
Dashboard
=========================================================
*/

router.get(
  "/dashboard",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {

      /*
      =====================================================
      تحديث الاشتراكات المنتهية تلقائيًا
      =====================================================
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
      =====================================================
      1 - إجمالي العملاء
      =====================================================
      */

      const [usersCount] =
        await db.query(
          `
          SELECT
            COUNT(*) AS total
          FROM users
          WHERE role = 'client'
          `
        );


      /*
      =====================================================
      2 - إجمالي الباقات
      =====================================================
      */

      const [packagesCount] =
        await db.query(
          `
          SELECT
            COUNT(*) AS total
          FROM packages
          `
        );


      /*
      =====================================================
      3 - الاشتراكات الفعالة
      =====================================================
      */

      const [
        activeSubscriptionsCount,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS total
        FROM subscriptions
        WHERE status = 'active'
        AND (
          end_date IS NULL
          OR end_date > NOW()
        )
        `
      );


      /*
      =====================================================
      4 - طلبات الاشتراك المعلقة
      =====================================================
      */

      const [
        pendingSubscriptionsCount,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS total
        FROM subscriptions
        WHERE status = 'pending'
        `
      );


      /*
      =====================================================
      5 - الاشتراكات المنتهية
      =====================================================
      */

      const [
        expiredSubscriptionsCount,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS total
        FROM subscriptions
        WHERE status = 'expired'
        OR (
          status = 'active'
          AND end_date IS NOT NULL
          AND end_date <= NOW()
        )
        `
      );


      /*
      =====================================================
      6 - الاشتراكات الموقوفة
      =====================================================
      */

      const [
        pausedSubscriptionsCount,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS total
        FROM subscriptions
        WHERE status = 'paused'
        AND (
          end_date IS NULL
          OR end_date > NOW()
        )
        `
      );


      /*
      =====================================================
      7 - عدد التحولات
      =====================================================
      */

      const [transformationsCount] =
        await db.query(
          `
          SELECT
            COUNT(*) AS total
          FROM transformations
          `
        );


      /*
      =====================================================
      8 - إجمالي الإيرادات
       
      نعتمد على الاشتراكات التي تم قبولها
      واستبعاد pending و rejected.

      الاشتراك المقبول يكون:
      active / paused / expired
      =====================================================
      */

      const [revenueResult] =
        await db.query(
          `
          SELECT
            COALESCE(
              SUM(p.price),
              0
            ) AS total
          FROM subscriptions s
          INNER JOIN packages p
            ON p.id = s.package_id
          WHERE s.status IN (
            'active',
            'paused',
            'expired'
          )
          `
        );


      /*
      =====================================================
      9 - إيرادات الشهر الحالي
      =====================================================
      */

      const [
        monthlyRevenueResult,
      ] = await db.query(
        `
        SELECT
          COALESCE(
            SUM(p.price),
            0
          ) AS total
        FROM subscriptions s
        INNER JOIN packages p
          ON p.id = s.package_id
        WHERE s.status IN (
          'active',
          'paused',
          'expired'
        )
        AND s.start_date IS NOT NULL
        AND YEAR(s.start_date) = YEAR(CURDATE())
        AND MONTH(s.start_date) = MONTH(CURDATE())
        `
      );


      /*
      =====================================================
      10 - العملاء الجدد هذا الشهر
      =====================================================
      */

      const [
        newClientsMonthResult,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS total
        FROM users
        WHERE role = 'client'
        AND created_at IS NOT NULL
        AND YEAR(created_at) = YEAR(CURDATE())
        AND MONTH(created_at) = MONTH(CURDATE())
        `
      );


      /*
      =====================================================
      11 - الاشتراكات التي ستنتهي خلال 7 أيام
      =====================================================
      */

      const [
        expiringSoonCount,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS total
        FROM subscriptions
        WHERE status = 'active'
        AND end_date IS NOT NULL
        AND end_date > NOW()
        AND end_date <= DATE_ADD(
          NOW(),
          INTERVAL 7 DAY
        )
        `
      );


      /*
      =====================================================
      12 - الاشتراكات التي ستنتهي قريبًا
      تفاصيل العملاء
      =====================================================
      */

      const [
        expiringSoonSubscriptions,
      ] = await db.query(
        `
        SELECT
          s.id,
          s.end_date,
          c.name AS client_name,
          c.email AS client_email,
          p.name AS package_name,
          p.price AS package_price,

          DATEDIFF(
            s.end_date,
            NOW()
          ) AS remaining_days

        FROM subscriptions s

        INNER JOIN users c
          ON c.id = s.client_id

        INNER JOIN packages p
          ON p.id = s.package_id

        WHERE s.status = 'active'

        AND s.end_date IS NOT NULL

        AND s.end_date > NOW()

        AND s.end_date <= DATE_ADD(
          NOW(),
          INTERVAL 7 DAY
        )

        ORDER BY
          s.end_date ASC

        LIMIT 10
        `
      );


      /*
      =====================================================
      13 - أكثر الباقات اشتراكًا
      =====================================================
      */

      const [
        popularPackages,
      ] = await db.query(
        `
        SELECT
          p.id,
          p.name,
          p.price,
          p.duration_days,

          COUNT(s.id) AS subscriptions_count

        FROM packages p

        LEFT JOIN subscriptions s
          ON s.package_id = p.id
          AND s.status IN (
            'active',
            'paused',
            'expired'
          )

        GROUP BY
          p.id,
          p.name,
          p.price,
          p.duration_days

        ORDER BY
          subscriptions_count DESC

        LIMIT 6
        `
      );


      /*
      =====================================================
      14 - نشاط الاشتراكات آخر 7 أيام
      =====================================================
      */

      const [
        subscriptionActivity,
      ] = await db.query(
        `
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS total

        FROM subscriptions

        WHERE created_at >= DATE_SUB(
          CURDATE(),
          INTERVAL 6 DAY
        )

        GROUP BY
          DATE(created_at)

        ORDER BY
          date ASC
        `
      );


      /*
      =====================================================
      15 - الاشتراكات الأخيرة
      =====================================================
      */

      const [
        recentSubscriptions,
      ] = await db.query(
        `
        SELECT
          s.id,
          s.status,
          s.created_at,
          s.start_date,
          s.end_date,

          c.name AS client_name,
          c.email AS client_email,

          p.name AS package_name,
          p.price AS package_price

        FROM subscriptions s

        INNER JOIN users c
          ON c.id = s.client_id

        INNER JOIN packages p
          ON p.id = s.package_id

        ORDER BY
          s.created_at DESC

        LIMIT 6
        `
      );


      /*
      =====================================================
      16 - العملاء الأخيرون
      =====================================================
      */

      const [
        recentClients,
      ] = await db.query(
        `
        SELECT
          id,
          name,
          email,
          created_at

        FROM users

        WHERE role = 'client'

        ORDER BY
          id DESC

        LIMIT 6
        `
      );


      /*
      =====================================================
      17 - توزيع حالات الاشتراكات
      =====================================================
      */

      const [
        subscriptionStatusRows,
      ] = await db.query(
        `
        SELECT
          status,
          COUNT(*) AS total

        FROM subscriptions

        GROUP BY
          status
        `
      );


      /*
      =====================================================
      تحويل توزيع الحالات إلى Object
      =====================================================
      */

      const subscriptionStatus = {
        pending: 0,
        active: 0,
        paused: 0,
        expired: 0,
        rejected: 0,
      };


      subscriptionStatusRows.forEach(
        (row) => {
          if (
            Object.prototype.hasOwnProperty.call(
              subscriptionStatus,
              row.status
            )
          ) {
            subscriptionStatus[
              row.status
            ] = Number(
              row.total || 0
            );
          }
        }
      );


      /*
      =====================================================
      18 - إجمالي عدد الاشتراكات
      =====================================================
      */

      const [
        totalSubscriptionsResult,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS total
        FROM subscriptions
        `
      );


      /*
      =====================================================
      إرسال النتيجة
      =====================================================
      */

      return res.json({
        success: true,

        user: req.user,


        /*
        ===================================================
        الإحصائيات الأساسية
        ===================================================
        */

        stats: {
          clients:
            Number(
              usersCount[0]?.total || 0
            ),

          packages:
            Number(
              packagesCount[0]?.total || 0
            ),

          activeSubscriptions:
            Number(
              activeSubscriptionsCount[0]?.total || 0
            ),

          pendingSubscriptions:
            Number(
              pendingSubscriptionsCount[0]?.total || 0
            ),

          expiredSubscriptions:
            Number(
              expiredSubscriptionsCount[0]?.total || 0
            ),

          pausedSubscriptions:
            Number(
              pausedSubscriptionsCount[0]?.total || 0
            ),

          transformations:
            Number(
              transformationsCount[0]?.total || 0
            ),


          /*
          الإيرادات
          */

          totalRevenue:
            Number(
              revenueResult[0]?.total || 0
            ),

          monthlyRevenue:
            Number(
              monthlyRevenueResult[0]?.total || 0
            ),


          /*
          العملاء الجدد
          */

          newClientsThisMonth:
            Number(
              newClientsMonthResult[0]?.total || 0
            ),


          /*
          الاشتراكات التي ستنتهي قريبًا
          */

          expiringSoon:
            Number(
              expiringSoonCount[0]?.total || 0
            ),


          /*
          إجمالي الاشتراكات
          */

          totalSubscriptions:
            Number(
              totalSubscriptionsResult[0]?.total || 0
            ),
        },


        /*
        ===================================================
        توزيع حالات الاشتراكات
        ===================================================
        */

        subscriptionStatus,


        /*
        ===================================================
        الاشتراكات الأخيرة
        ===================================================
        */

        recentSubscriptions:


          recentSubscriptions.map(
            (subscription) => ({
              ...subscription,

              package_price:
                Number(
                  subscription.package_price ||
                    0
                ),
            })
          ),


        /*
        ===================================================
        العملاء الأخيرون
        ===================================================
        */

        recentClients,


        /*
        ===================================================
        الاشتراكات التي ستنتهي خلال 7 أيام
        ===================================================
        */

        expiringSoonSubscriptions:


          expiringSoonSubscriptions.map(
            (subscription) => ({
              ...subscription,

              package_price:
                Number(
                  subscription.package_price ||
                    0
                ),

              remaining_days:
                Math.max(
                  0,
                  Number(
                    subscription.remaining_days ||
                      0
                  )
                ),
            })
          ),


        /*
        ===================================================
        أكثر الباقات اشتراكًا
        ===================================================
        */

        popularPackages:


          popularPackages.map(
            (pkg) => ({
              ...pkg,

              price:
                Number(
                  pkg.price || 0
                ),

              duration_days:
                Number(
                  pkg.duration_days ||
                    0
                ),

              subscriptions_count:
                Number(
                  pkg.subscriptions_count ||
                    0
                ),
            })
          ),


        /*
        ===================================================
        نشاط آخر 7 أيام
        ===================================================
        */

        subscriptionActivity:


          subscriptionActivity.map(
            (item) => ({
              date:
                item.date,

              total:
                Number(
                  item.total || 0
                ),
            })
          ),
      });

    } catch (error) {

      console.error(
        "Dashboard error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "حدث خطأ أثناء تحميل لوحة التحكم",

        /*
        لا نرسل تفاصيل الخطأ للمستخدم
        */

      });
    }
  }
);


module.exports = router;