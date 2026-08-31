import API_URL from "../config/api";
import React from "react";
import { useNavigate } from "react-router-dom";

function ClientSubscriptions() {
  const [subscription, setSubscription] =
    React.useState(null);

  const [loading, setLoading] =
    React.useState(true);

  const [error, setError] =
    React.useState("");

  const navigate = useNavigate();

  const token =
    localStorage.getItem("token");

  /*
  ========================================
  جلب الاشتراك
  ========================================
  */

  const loadSubscription =
    async () => {
      try {
        setLoading(true);
        setError("");

        if (!token) {
          navigate(
            "/login",
            {
              replace: true,
            }
          );

          return;
        }

        const response =
          await fetch(
            `${API_URL}/subscriptions/my`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          setError(
            data.message ||
              "تعذر تحميل بيانات الاشتراك"
          );

          return;
        }

        setSubscription(
          data.subscription ||
            null
        );
      } catch {
        setError(
          "تعذر الاتصال بالسيرفر"
        );
      } finally {
        setLoading(false);
      }
    };

  /*
  ========================================
  تحميل البيانات
  ========================================
  */

  React.useEffect(() => {
    loadSubscription();
  }, []);

  /*
  ========================================
  حالة الاشتراك
  ========================================
  */

  const getStatusInfo =
    () => {
      if (!subscription) {
        return {
          label:
            "لا يوجد اشتراك",

          description:
            "لم تشترك في أي باقة حتى الآن. اختر الباقة المناسبة وابدأ رحلتك التدريبية.",

          className:
            "no-subscription",

          icon: "✦",
        };
      }

      switch (
        subscription.status
      ) {
        case "pending":
          return {
            label:
              "طلبك قيد المراجعة",

            description:
              "تم إرسال طلب الاشتراك إلى المدرب، وبانتظار موافقته.",

            className:
              "pending",

            icon: "⏳",
          };

        case "active":
          return {
            label:
              "اشتراكك فعال",

            description:
              "يمكنك الاستفادة من برنامجك التدريبي ومتابعة تقدمك.",

            className:
              "active",

            icon: "✓",
          };

        case "paused":
          return {
            label:
              "الاشتراك متوقف",

            description:
              "قام المدرب بإيقاف الاشتراك مؤقتًا حتى التجديد.",

            className:
              "paused",

            icon: "Ⅱ",
          };

        case "rejected":
          return {
            label:
              "تم رفض طلب الاشتراك",

            description:
              "يمكنك اختيار باقة أخرى وإرسال طلب جديد.",

            className:
              "rejected",

            icon: "!",
          };

        case "expired":
          return {
            label:
              "انتهى الاشتراك",

            description:
              "انتهت مدة اشتراكك. يمكنك اختيار باقة للتجديد.",

            className:
              "expired",

            icon: "◷",
          };

        default:
          return {
            label:
              "حالة غير معروفة",

            description:
              "تعذر تحديد حالة الاشتراك الحالية.",

            className:
              "pending",

            icon: "!",
          };
      }
    };

  const statusInfo =
    getStatusInfo();

  /*
  ========================================
  Loading
  ========================================
  */

  if (loading) {
    return (
      <div
        className="client-placeholder-page"
        dir="rtl"
      >
        <span>
          ✦
        </span>

        <h1>
          جاري تحميل اشتراكك...
        </h1>

        <p>
          لحظات ونحضر لك بيانات الاشتراك.
        </p>
      </div>
    );
  }

  /*
  ========================================
  Error
  ========================================
  */

  if (error) {
    return (
      <div
        className="client-placeholder-page"
        dir="rtl"
      >
        <span>
          !
        </span>

        <h1>
          حدث خطأ
        </h1>

        <p>
          {error}
        </p>

        <button
          type="button"
          onClick={
            loadSubscription
          }
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  /*
  ========================================
  الصفحة
  ========================================
  */

  return (
    <div
      className="client-subscriptions-page"
      dir="rtl"
    >
      <div className="subscriptions-page-header">

        <span className="luxury-section-label">
          MEMBERSHIP
        </span>

        <h1>
          اشتراكي
        </h1>

        <p>
          تابع حالة اشتراكك وتفاصيل باقتك الحالية.
        </p>

      </div>

      <section className="client-subscription-card subscription-page-card">

        <div className="subscription-card-header">

          <div>

            <span className="luxury-section-label">
              MY MEMBERSHIP
            </span>

            <h2>
              حالة الاشتراك
            </h2>

          </div>

          <div className="subscription-crown">
            ✦
          </div>

        </div>

        <div
          className={`subscription-status ${statusInfo.className}`}
        >

          <div className="subscription-status-icon">
            {statusInfo.icon}
          </div>

          <div className="subscription-status-content">

            <strong>
              {statusInfo.label}
            </strong>

            <p>
              {
                statusInfo.description
              }
            </p>

          </div>

        </div>

        {subscription && (
          <div className="subscription-details">

            <div className="subscription-detail">

              <span>
                الباقة
              </span>

              <strong>
                {
                  subscription.package_name ||
                  "—"
                }
              </strong>

            </div>

            <div className="subscription-detail">

              <span>
                السعر
              </span>

              <strong>
                {subscription.package_price !=
                null
                  ? `${Number(
                      subscription.package_price
                    ).toLocaleString(
                      "ar-EG"
                    )} جنيه`
                  : "—"}
              </strong>

            </div>

            <div className="subscription-detail">

              <span>
                مدة الباقة
              </span>

              <strong>
                {subscription.duration_days
                  ? `${subscription.duration_days} يوم`
                  : "—"}
              </strong>

            </div>

            <div className="subscription-detail">

              <span>
                تاريخ البداية
              </span>

              <strong>
                {subscription.start_date
                  ? new Date(
                      subscription.start_date
                    ).toLocaleDateString(
                      "ar-EG"
                    )
                  : "لم تبدأ بعد"}
              </strong>

            </div>

            <div className="subscription-detail">

              <span>
                تاريخ الانتهاء
              </span>

              <strong>
                {subscription.end_date
                  ? new Date(
                      subscription.end_date
                    ).toLocaleDateString(
                      "ar-EG"
                    )
                  : "—"}
              </strong>

            </div>

          </div>
        )}

        <div className="subscription-page-actions">

          <button
            type="button"
            onClick={() =>
              navigate(
                "/client/packages"
              )
            }
          >
            💎 عرض الباقات

            <b>
              ←
            </b>

          </button>

        </div>

      </section>
    </div>
  );
}

export default ClientSubscriptions;