import API_URL from "../config/api";
import { useEffect, useState } from "react";

function ClientPackages() {
  const [packages, setPackages] =
    useState([]);

  const [
    subscription,
    setSubscription,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    subscriptionLoading,
    setSubscriptionLoading,
  ] = useState(true);

  const [error, setError] =
    useState("");

  const [
    requestingId,
    setRequestingId,
  ] = useState(null);

  const token =
    localStorage.getItem("token");

  let user = null;

  try {
    user = JSON.parse(
      localStorage.getItem(
        "user"
      ) || "null"
    );
  } catch {
    user = null;
  }

  /*
  ========================================
  جلب الباقات
  ========================================
  */

  const fetchPackages =
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `${API_URL}/packages`
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          setError(
            data.message ||
              "تعذر تحميل الباقات"
          );

          return;
        }

        /*
        مهم:
        الباقات التي is_active = 0
        لا تظهر للعميل.
        */

        const availablePackages = (
          data.packages ||
          []
        ).filter(
          (pkg) =>
            pkg.is_active !==
              false &&
            Number(
              pkg.is_active
            ) !== 0
        );

        setPackages(
          availablePackages
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
  جلب اشتراك العميل الحالي
  ========================================
  */

  const fetchSubscription =
    async () => {
      try {
        setSubscriptionLoading(
          true
        );

        if (!token) {
          setSubscription(
            null
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
          setSubscription(
            null
          );

          return;
        }

        setSubscription(
          data.subscription ||
            null
        );
      } catch {
        setSubscription(
          null
        );
      } finally {
        setSubscriptionLoading(
          false
        );
      }
    };

  /*
  ========================================
  تحميل البيانات
  ========================================
  */

  useEffect(() => {
    fetchPackages();
    fetchSubscription();
  }, []);

  /*
  ========================================
  تسجيل الخروج
  ========================================
  */

  const logout = () => {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    window.location.href =
      "/login";
  };

  /*
  ========================================
  هل يستطيع العميل اختيار باقة؟
  ========================================
  */

  const hasBlockingSubscription =
    subscription &&
    [
      "pending",
      "active",
      "paused",
    ].includes(
      subscription.status
    );

  /*
  ========================================
  اختيار الباقة
  ========================================
  */

  const choosePackage =
    async (pkg) => {
      if (!token) {
        alert(
          "يجب تسجيل الدخول أولًا"
        );

        window.location.href =
          "/login";

        return;
      }

      if (
        hasBlockingSubscription
      ) {
        if (
          subscription.status ===
          "pending"
        ) {
          alert(
            "لديك طلب اشتراك قيد المراجعة بالفعل."
          );
        } else if (
          subscription.status ===
          "active"
        ) {
          alert(
            "لديك اشتراك فعال بالفعل."
          );
        } else if (
          subscription.status ===
          "paused"
        ) {
          alert(
            "اشتراكك موقوف حاليًا. يمكنك التواصل مع المدرب لتجديده."
          );
        }

        return;
      }

      const confirmed =
        window.confirm(
          `هل تريد إرسال طلب الاشتراك في باقة "${pkg.name}" بسعر ${pkg.price} جنيه؟`
        );

      if (!confirmed) {
        return;
      }

      try {
        setRequestingId(
          pkg.id
        );

        const response =
          await fetch(
            `${API_URL}/subscriptions`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                package_id:
                  pkg.id,
              }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          alert(
            data.message ||
              "حدث خطأ أثناء إرسال الطلب"
          );

          return;
        }

        alert(
          "تم إرسال طلب الاشتراك إلى المدرب بنجاح. سيتم تفعيل الاشتراك بعد موافقته."
        );

        await fetchSubscription();
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      } finally {
        setRequestingId(
          null
        );
      }
    };

  /*
  ========================================
  معلومات حالة الاشتراك
  ========================================
  */

  const getSubscriptionStatus =
    () => {
      if (!subscription) {
        return null;
      }

      switch (
        subscription.status
      ) {
        case "pending":
          return {
            title:
              "طلبك قيد المراجعة",

            description:
              "تم إرسال طلب الاشتراك إلى المدرب، وبانتظار الموافقة.",

            className:
              "subscription-status pending",
          };

        case "active":
          return {
            title:
              "اشتراكك فعال",

            description:
              subscription.end_date
                ? `ينتهي اشتراكك في ${new Date(
                    subscription.end_date
                  ).toLocaleDateString(
                    "ar-EG"
                  )}`
                : "اشتراكك فعال حاليًا.",

            className:
              "subscription-status active",
          };

        case "paused":
          return {
            title:
              "اشتراكك موقوف",

            description:
              "تم إيقاف الاشتراك مؤقتًا من المدرب حتى التجديد.",

            className:
              "subscription-status paused",
          };

        case "rejected":
          return {
            title:
              "تم رفض طلب الاشتراك",

            description:
              "يمكنك اختيار باقة أخرى وإرسال طلب جديد.",

            className:
              "subscription-status rejected",
          };

        case "expired":
          return {
            title:
              "انتهى الاشتراك",

            description:
              "انتهت مدة اشتراكك ويمكنك طلب باقة جديدة.",

            className:
              "subscription-status expired",
          };

        default:
          return null;
      }
    };

  const statusInfo =
    getSubscriptionStatus();

  /*
  ========================================
  تحويل المميزات من النص إلى قائمة
  ========================================
  */

  const getFeatures =
    (pkg) => {
      /*
      إذا كانت الباقة الجديدة تحتوي
      على features من قاعدة البيانات،
      نستخدمها.
      */

      if (
        pkg.features &&
        String(
          pkg.features
        ).trim()
      ) {
        return String(
          pkg.features
        )
          .split("\n")
          .map(
            (feature) =>
              feature.trim()
          )
          .filter(Boolean);
      }

      /*
      للحفاظ على الباقات القديمة
      التي لم يكن لديها features.
      */

      return [
        "برنامج تدريبي مخصص",
        "متابعة مع المدرب",
        "تمارين منظمة",
        "متابعة تقدمك",
      ];
    };

  /*
  ========================================
  Loading
  ========================================
  */

  if (loading) {
    return (
      <div
        className="client-packages-page"
        dir="rtl"
      >
        <div className="packages-loading">

          <div className="loading-icon">
            ✦
          </div>

          <h2>
            جاري تحميل الباقات
          </h2>

          <p>
            نجهز لك أفضل خيارات التدريب
          </p>

          <div className="loading-line">
            <span />
          </div>

        </div>
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
        className="client-packages-page"
        dir="rtl"
      >
        <div className="packages-error">

          <div className="error-icon">
            !
          </div>

          <h2>
            حدث خطأ
          </h2>

          <p>
            {error}
          </p>

          <button
            type="button"
            className="luxury-button"
            onClick={
              fetchPackages
            }
          >
            إعادة المحاولة
          </button>

        </div>
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
      className="client-packages-page"
      dir="rtl"
    >

      {/* Header */}

      <header className="client-packages-header">

        <div className="brand">

          <span>
            GYM
          </span>

          <strong>
            COACH
          </strong>

        </div>

        <div className="user-section">

          <div className="avatar">

            {user?.name
              ? user.name.charAt(
                  0
                )
              : "👤"}

          </div>

          <div className="user-info">

            <strong>
              {user?.name ||
                "العميل"}
            </strong>

            <span>
              حساب العميل
            </span>

          </div>

          <button
            type="button"
            className="logout-button"
            onClick={
              logout
            }
          >
            تسجيل الخروج
          </button>

        </div>

      </header>

      {/* Hero */}

      <section className="packages-hero">

        <div className="hero-glow" />

        <div className="hero-symbol">
          ✦
        </div>

        <span className="premium-label">
          PREMIUM MEMBERSHIP
        </span>

        <h1>
          اختر باقتك التدريبية
        </h1>

        <p>
          استثمر في نفسك وابدأ رحلتك نحو
          <br />
          جسم أقوى وحياة أفضل.
        </p>

        <div className="gold-line">

          <span />

          <b>
            ✦
          </b>

          <span />

        </div>

      </section>

      {/* Subscription Status */}

      {!subscriptionLoading &&
        statusInfo && (
          <section
            className={
              statusInfo.className
            }
          >

            <div className="subscription-status-icon">

              {subscription.status ===
              "active"
                ? "✓"
                : subscription.status ===
                  "pending"
                ? "⏳"
                : subscription.status ===
                  "paused"
                ? "Ⅱ"
                : subscription.status ===
                  "rejected"
                ? "!"
                : "◷"}

            </div>

            <div>

              <h3>
                {
                  statusInfo.title
                }
              </h3>

              <p>
                {
                  statusInfo.description
                }
              </p>

              {subscription.package_name && (
                <span>
                  الباقة:{" "}
                  {
                    subscription.package_name
                  }
                </span>
              )}

            </div>

          </section>
        )}

      {/* Packages */}

      <main className="client-packages-content">

        {packages.length ===
        0 ? (

          <div className="packages-empty">

            <div className="empty-icon">
              ✦
            </div>

            <h2>
              لا توجد باقات متاحة حاليًا
            </h2>

            <p>
              سيقوم المدرب بإضافة الباقات قريبًا.
            </p>

          </div>

        ) : (

          <div className="client-packages-grid">

            {packages.map(
              (pkg) => {

                /*
                ========================================
                الباقة المميزة الحقيقية
                ========================================

                الآن الباقة المميزة تأتي
                من قاعدة البيانات:
                is_featured
                */

                const featured =
                  Boolean(
                    pkg.is_featured
                  );

                const isRequesting =
                  requestingId ===
                  pkg.id;

                const disabled =
                  isRequesting ||
                  Boolean(
                    hasBlockingSubscription
                  );

                const features =
                  getFeatures(
                    pkg
                  );

                return (
                  <article
                    className={`client-package-card ${
                      featured
                        ? "featured"
                        : ""
                    }`}
                    key={
                      pkg.id
                    }
                  >

                    {/* Featured Badge */}

                    {featured && (
                      <div className="featured-badge">

                        ⭐ الباقة المميزة

                      </div>
                    )}

                    {/* Card Top */}

                    <div className="package-card-top">

                      <div className="package-icon">
                        ✦
                      </div>

                      <span>
                        باقة تدريب
                      </span>

                    </div>

                    {/* Name */}

                    <h2>
                      {pkg.name}
                    </h2>

                    {/* Description */}

                    {pkg.description && (
                      <p className="package-description">
                        {
                          pkg.description
                        }
                      </p>
                    )}

                    <div className="package-divider" />

                    {/* Price */}

                    <div className="package-price">

                      <strong>
                        {Number(
                          pkg.price
                        ).toLocaleString(
                          "ar-EG"
                        )}
                      </strong>

                      <div>

                        <span>
                          جنيه
                        </span>

                        <small>
                          / الباقة
                        </small>

                      </div>

                    </div>

                    {/* Duration */}

                    <div className="package-duration">

                      <div className="duration-icon">
                        ◷
                      </div>

                      <div>

                        <span>
                          مدة الاشتراك
                        </span>

                        <strong>
                          {
                            pkg.duration_days
                          }{" "}
                          يوم
                        </strong>

                      </div>

                    </div>

                    {/* Features */}

                    <div className="package-features">

                      {features.map(
                        (
                          feature,
                          index
                        ) => (

                          <div
                            key={`${pkg.id}-feature-${index}`}
                          >

                            <span>
                              ✓
                            </span>

                            <p>
                              {
                                feature
                              }
                            </p>

                          </div>

                        )
                      )}

                    </div>

                    {/* Choose */}

                    <button
                      type="button"
                      className={`choose-package-button ${
                        disabled
                          ? "disabled"
                          : ""
                      }`}
                      disabled={
                        disabled
                      }
                      onClick={() =>
                        choosePackage(
                          pkg
                        )
                      }
                    >

                      <span>
                        {isRequesting
                          ? "جاري إرسال الطلب..."
                          : subscription?.status ===
                            "pending"
                          ? "طلب قيد المراجعة"
                          : subscription?.status ===
                            "active"
                          ? "لديك اشتراك فعال"
                          : subscription?.status ===
                            "paused"
                          ? "الاشتراك موقوف"
                          : "اختيار الباقة"}
                      </span>

                      <b>
                        {isRequesting
                          ? "..."
                          : "←"}
                      </b>

                    </button>

                  </article>
                );
              }
            )}

          </div>

        )}

      </main>

      {/* Footer */}

      <footer className="packages-footer">

        <span>
          ✦
        </span>

        <p>
          ابدأ اليوم، واصنع أفضل نسخة من نفسك
        </p>

        <span>
          ✦
        </span>

      </footer>

    </div>
  );
}

export default ClientPackages;