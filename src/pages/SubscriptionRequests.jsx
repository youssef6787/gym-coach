import API_URL from "../config/api";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

function SubscriptionRequests() {
  const [
    subscriptions,
    setSubscriptions,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [actionId, setActionId] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const token =
    localStorage.getItem(
      "token"
    );

  /*
  =====================================================
  جلب الاشتراكات
  =====================================================
  */

  const fetchSubscriptions =
    async () => {
      try {
        setLoading(true);
        setError("");

        if (!token) {
          setError(
            "يجب تسجيل الدخول أولًا"
          );

          return;
        }

        const response =
          await fetch(
            `${API_URL}/subscriptions/admin`,
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
              "تعذر تحميل طلبات الاشتراك"
          );

          return;
        }

        setSubscriptions(
          data.subscriptions ||
            []
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
  =====================================================
  التحميل عند فتح الصفحة
  =====================================================
  */

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  /*
  =====================================================
  النص الخاص بالحالة
  =====================================================
  */

  const getStatusText = (
    status
  ) => {
    switch (status) {
      case "pending":
        return "قيد المراجعة";

      case "active":
        return "فعال";

      case "rejected":
        return "مرفوض";

      case "expired":
        return "منتهي";

      case "paused":
        return "موقوف";

      default:
        return (
          status ||
          "غير معروف"
        );
    }
  };

  /*
  =====================================================
  أيقونة الحالة
  =====================================================
  */

  const getStatusIcon = (
    status
  ) => {
    switch (status) {
      case "pending":
        return "⏳";

      case "active":
        return "✓";

      case "rejected":
        return "!";

      case "expired":
        return "◷";

      case "paused":
        return "Ⅱ";

      default:
        return "•";
    }
  };

  /*
  =====================================================
  معالجة حالة الاشتراك المنتهي
  =====================================================
  */

  const getDisplayStatus = (
    subscription
  ) => {
    if (
      subscription.status ===
        "active" &&
      subscription.end_date
    ) {
      const endDate =
        new Date(
          subscription.end_date
        );

      if (
        !Number.isNaN(
          endDate.getTime()
        ) &&
        endDate.getTime() <=
          Date.now()
      ) {
        return "expired";
      }
    }

    return subscription.status;
  };

  /*
  =====================================================
  تنفيذ عمليات الاشتراك
  =====================================================
  */

  const performAction =
    async ({
      subscription,
      endpoint,
      confirmMessage,
    }) => {
      if (!token) {
        alert(
          "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى."
        );

        window.location.href =
          "/login";

        return;
      }

      const confirmed =
        window.confirm(
          confirmMessage
        );

      if (!confirmed) {
        return;
      }

      try {
        setActionId(
          subscription.id
        );

        const response =
          await fetch(
            `${API_URL}/subscriptions/${subscription.id}/${endpoint}`,
            {
              method: "PUT",

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
          alert(
            data.message ||
              "حدث خطأ أثناء تنفيذ العملية"
          );

          return;
        }

        alert(
          data.message ||
            "تم تنفيذ العملية بنجاح"
        );

        await fetchSubscriptions();
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      } finally {
        setActionId(null);
      }
    };

  /*
  =====================================================
  قبول الاشتراك
  =====================================================
  */

  const approveSubscription =
    async (subscription) => {
      await performAction({
        subscription,

        endpoint:
          "approve",

        confirmMessage:
          `هل تريد قبول اشتراك ${subscription.client_name} في باقة ${subscription.package_name}؟`,
      });
    };

  /*
  =====================================================
  رفض الاشتراك
  =====================================================
  */

  const rejectSubscription =
    async (subscription) => {
      await performAction({
        subscription,

        endpoint:
          "reject",

        confirmMessage:
          `هل أنت متأكد من رفض طلب ${subscription.client_name}؟`,
      });
    };

  /*
  =====================================================
  إيقاف الاشتراك
  =====================================================
  */

  const pauseSubscription =
    async (subscription) => {
      await performAction({
        subscription,

        endpoint:
          "pause",

        confirmMessage:
          `هل تريد إيقاف اشتراك ${subscription.client_name} مؤقتًا؟`,
      });
    };

  /*
  =====================================================
  استئناف الاشتراك
  =====================================================
  */

  const resumeSubscription =
    async (subscription) => {
      await performAction({
        subscription,

        endpoint:
          "resume",

        confirmMessage:
          `هل تريد استئناف اشتراك ${subscription.client_name}؟`,
      });
    };

  /*
  =====================================================
  تنسيق التاريخ
  =====================================================
  */

  const formatDate = (
    date
  ) => {
    if (!date) {
      return "—";
    }

    try {
      const parsedDate =
        new Date(date);

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return "—";
      }

      return parsedDate.toLocaleDateString(
        "ar-EG",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      );
    } catch {
      return "—";
    }
  };

  /*
  =====================================================
  تنسيق التاريخ والوقت
  =====================================================
  */

  const formatDateTime =
    (date) => {
      if (!date) {
        return "—";
      }

      try {
        const parsedDate =
          new Date(date);

        if (
          Number.isNaN(
            parsedDate.getTime()
          )
        ) {
          return "—";
        }

        return parsedDate.toLocaleString(
          "ar-EG",
          {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }
        );
      } catch {
        return "—";
      }
    };

  /*
  =====================================================
  الأيام المتبقية
  =====================================================
  */

  const getRemainingDays =
    (endDate) => {
      if (!endDate) {
        return null;
      }

      const end =
        new Date(endDate);

      if (
        Number.isNaN(
          end.getTime()
        )
      ) {
        return null;
      }

      const now =
        new Date();

      const difference =
        end.getTime() -
        now.getTime();

      const days =
        Math.ceil(
          difference /
            (1000 *
              60 *
              60 *
              24)
        );

      return days > 0
        ? days
        : 0;
    };

  /*
  =====================================================
  البيانات بعد حساب الحالة
  =====================================================
  */

  const normalizedSubscriptions =
    useMemo(
      () => {
        return subscriptions.map(
          (subscription) => ({
            ...subscription,

            displayStatus:
              getDisplayStatus(
                subscription
              ),
          })
        );
      },
      [subscriptions]
    );

  /*
  =====================================================
  الإحصائيات
  =====================================================
  */

  const statistics =
    useMemo(
      () => {
        const total =
          normalizedSubscriptions.length;

        const pending =
          normalizedSubscriptions.filter(
            (item) =>
              item.displayStatus ===
              "pending"
          ).length;

        const active =
          normalizedSubscriptions.filter(
            (item) =>
              item.displayStatus ===
              "active"
          ).length;

        const paused =
          normalizedSubscriptions.filter(
            (item) =>
              item.displayStatus ===
              "paused"
          ).length;

        const rejected =
          normalizedSubscriptions.filter(
            (item) =>
              item.displayStatus ===
              "rejected"
          ).length;

        const expired =
          normalizedSubscriptions.filter(
            (item) =>
              item.displayStatus ===
              "expired"
          ).length;

        return {
          total,
          pending,
          active,
          paused,
          rejected,
          expired,
        };
      },
      [
        normalizedSubscriptions,
      ]
    );

  /*
  =====================================================
  البحث والفلترة
  =====================================================
  */

  const filteredSubscriptions =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return normalizedSubscriptions.filter(
          (subscription) => {
            const status =
              subscription.displayStatus;

            if (
              statusFilter !==
                "all" &&
              status !==
                statusFilter
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            const searchText = [
              subscription.client_name,
              subscription.client_email,
              subscription.package_name,
              subscription.package_price,
              subscription.id,
            ]
              .filter(
                (value) =>
                  value !==
                    null &&
                  value !==
                    undefined
              )
              .join(" ")
              .toLowerCase();

            return searchText.includes(
              query
            );
          }
        );
      },
      [
        normalizedSubscriptions,
        search,
        statusFilter,
      ]
    );

  /*
  =====================================================
  إعادة الفلاتر
  =====================================================
  */

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  /*
  =====================================================
  Loading
  =====================================================
  */

  if (loading) {
    return (
      <div
        className="subscription-requests-page"
        dir="rtl"
      >
        <div className="subscription-requests-loading">

          <div className="loading-icon">
            ✦
          </div>

          <h1>
            جاري تحميل طلبات الاشتراك...
          </h1>

          <p>
            نجهز لك بيانات اشتراكات العملاء
          </p>

        </div>
      </div>
    );
  }

  /*
  =====================================================
  Error
  =====================================================
  */

  if (error) {
    return (
      <div
        className="subscription-requests-page"
        dir="rtl"
      >
        <div className="subscription-requests-empty">

          <div className="empty-icon">
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
            onClick={
              fetchSubscriptions
            }
          >
            إعادة المحاولة
          </button>

        </div>
      </div>
    );
  }

  /*
  =====================================================
  الصفحة
  =====================================================
  */

  return (
    <div
      className="subscription-requests-page"
      dir="rtl"
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="subscription-requests-header">

        <div className="subscription-header-content">

          <div className="subscription-header-eyebrow">
            SUBSCRIPTIONS
          </div>

          <h1>
            طلبات الاشتراك
          </h1>

          <p>
            راجع طلبات العملاء وتحكم في
            اشتراكاتهم من مكان واحد.
          </p>

        </div>

        <div className="subscription-header-actions">

          <button
            type="button"
            className="refresh-subscriptions-button"
            onClick={
              fetchSubscriptions
            }
            disabled={
              actionId !== null
            }
          >
            ↻ تحديث البيانات
          </button>

        </div>

      </div>

      {/* =================================================
          STATISTICS
      ================================================= */}

      <div className="subscription-requests-stats">

        <div className="subscription-stat-card">

          <span>
            إجمالي الطلبات
          </span>

          <strong>
            {statistics.total}
          </strong>

        </div>

        <div className="subscription-stat-card pending">

          <span>
            قيد المراجعة
          </span>

          <strong>
            {statistics.pending}
          </strong>

        </div>

        <div className="subscription-stat-card active">

          <span>
            الاشتراكات الفعالة
          </span>

          <strong>
            {statistics.active}
          </strong>

        </div>

        <div className="subscription-stat-card paused">

          <span>
            الاشتراكات الموقوفة
          </span>

          <strong>
            {statistics.paused}
          </strong>

        </div>

      </div>

      {/* =================================================
          SEARCH + FILTER
      ================================================= */}

      <div className="subscription-requests-filters">

        <div className="subscription-filter-group">

          <label>
            البحث عن عميل
          </label>

          <input
            type="text"
            value={
              search
            }
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
            placeholder="اسم العميل، البريد الإلكتروني أو الباقة..."
          />

        </div>

        <div className="subscription-filter-group">

          <label>
            حالة الاشتراك
          </label>

          <select
            value={
              statusFilter
            }
            onChange={(
              event
            ) =>
              setStatusFilter(
                event.target
                  .value
              )
            }
          >
            <option value="all">
              كل الحالات
            </option>

            <option value="pending">
              قيد المراجعة
            </option>

            <option value="active">
              فعال
            </option>

            <option value="paused">
              موقوف
            </option>

            <option value="expired">
              منتهي
            </option>

            <option value="rejected">
              مرفوض
            </option>
          </select>

        </div>

        <button
          type="button"
          className="subscription-filter-reset"
          onClick={
            resetFilters
          }
        >
          إعادة الفلترة
        </button>

      </div>

      {/* =================================================
          RESULT COUNT
      ================================================= */}

      <div className="subscription-requests-result-count">

        <span>

          عرض{" "}
          <strong>
            {
              filteredSubscriptions.length
            }
          </strong>{" "}
          من{" "}
          <strong>
            {
              normalizedSubscriptions.length
            }
          </strong>{" "}
          اشتراك

        </span>

        {(search ||
          statusFilter !==
            "all") && (
          <span>
            الفلاتر مفعلة
          </span>
        )}

      </div>

      {/* =================================================
          EMPTY
      ================================================= */}

      {filteredSubscriptions.length ===
      0 ? (

        <div className="subscription-requests-empty">

          <div className="empty-icon">
            {subscriptions.length ===
            0
              ? "✦"
              : "⌕"}
          </div>

          <h2>
            {subscriptions.length ===
            0
              ? "لا توجد طلبات اشتراك"
              : "لا توجد نتائج"}
          </h2>

          <p>
            {subscriptions.length ===
            0
              ? "ستظهر طلبات العملاء هنا عند اختيارهم لإحدى الباقات."
              : "لم نجد أي اشتراك مطابق للبحث أو الفلتر الحالي."}
          </p>

          {subscriptions.length >
            0 && (
            <button
              type="button"
              onClick={
                resetFilters
              }
            >
              إظهار كل الاشتراكات
            </button>
          )}

        </div>

      ) : (

        /* =================================================
           CARDS
        ================================================= */

        <div className="subscription-requests-grid">

          {filteredSubscriptions.map(
            (subscription) => {
              const status =
                subscription.displayStatus;

              const isLoading =
                actionId ===
                subscription.id;

              const remainingDays =
                getRemainingDays(
                  subscription.end_date
                );

              return (
                <article
                  key={
                    subscription.id
                  }
                  className={`subscription-request-card ${status}`}
                >

                  {/* STATUS */}

                  <div
                    style={{
                      display:
                        "flex",

                      justifyContent:
                        "space-between",

                      alignItems:
                        "center",

                      gap: "10px",
                    }}
                  >

                    <div
                      className={`subscription-request-status-badge ${status}`}
                    >
                      <span>
                        {getStatusIcon(
                          status
                        )}
                      </span>

                      {getStatusText(
                        status
                      )}
                    </div>

                    <span
                      style={{
                        color:
                          "#5f5669",

                        fontSize:
                          "9px",

                        fontWeight:
                          "800",
                      }}
                    >
                      #
                      {
                        subscription.id
                      }
                    </span>

                  </div>

                  {/* CLIENT */}

                  <div className="subscription-request-client">

                    <div className="subscription-request-client-avatar">

                      {subscription.client_name
                        ? subscription.client_name.charAt(
                            0
                          )
                        : "👤"}

                    </div>

                    <div className="subscription-request-client-info">

                      <strong>
                        {
                          subscription.client_name ||
                          "عميل"
                        }
                      </strong>

                      <span>
                        {
                          subscription.client_email ||
                          "لا يوجد بريد إلكتروني"
                        }
                      </span>

                    </div>

                  </div>

                  {/* PACKAGE */}

                  <div className="subscription-request-package">

                    <span className="subscription-request-package-label">
                      الباقة الحالية
                    </span>

                    <strong className="subscription-request-package-name">
                      {
                        subscription.package_name ||
                        "بدون باقة"
                      }
                    </strong>

                    <div className="subscription-request-package-meta">

                      <div>

                        <span>
                          السعر
                        </span>

                        <strong>
                          {Number(
                            subscription.package_price ||
                              0
                          ).toLocaleString(
                            "ar-EG"
                          )}{" "}
                          جنيه
                        </strong>

                      </div>

                      <div>

                        <span>
                          المدة
                        </span>

                        <strong>
                          {
                            subscription.duration_days ||
                            0
                          }{" "}
                          يوم
                        </strong>

                      </div>

                    </div>

                  </div>

                  {/* DETAILS */}

                  <div className="subscription-request-details">

                    <div>

                      <span>
                        تاريخ الطلب
                      </span>

                      <strong>
                        {formatDateTime(
                          subscription.created_at
                        )}
                      </strong>

                    </div>

                    <div>

                      <span>
                        بداية الاشتراك
                      </span>

                      <strong>
                        {formatDate(
                          subscription.start_date
                        )}
                      </strong>

                    </div>

                    <div>

                      <span>
                        نهاية الاشتراك
                      </span>

                      <strong>
                        {formatDate(
                          subscription.end_date
                        )}
                      </strong>

                    </div>

                    <div>

                      <span>
                        الحالة
                      </span>

                      <strong>
                        {getStatusText(
                          status
                        )}
                      </strong>

                    </div>

                  </div>

                  {/* REMAINING DAYS */}

                  {status ===
                    "active" &&
                    remainingDays !==
                      null && (

                    <div className="subscription-remaining-days">

                      <span>
                        الأيام المتبقية
                      </span>

                      <strong>
                        {
                          remainingDays
                        }
                      </strong>

                      <small>
                        يوم
                      </small>

                    </div>
                  )}

                  {/* PENDING ACTIONS */}

                  {status ===
                    "pending" && (

                    <div className="subscription-request-actions">

                      <button
                        type="button"
                        className="approve-subscription-button"
                        disabled={
                          isLoading
                        }
                        onClick={() =>
                          approveSubscription(
                            subscription
                          )
                        }
                      >
                        {isLoading
                          ? "جاري التنفيذ..."
                          : "✓ قبول الاشتراك"}
                      </button>

                      <button
                        type="button"
                        className="reject-subscription-button"
                        disabled={
                          isLoading
                        }
                        onClick={() =>
                          rejectSubscription(
                            subscription
                          )
                        }
                      >
                        {isLoading
                          ? "جاري التنفيذ..."
                          : "✕ رفض الطلب"}
                      </button>

                    </div>
                  )}

                  {/* ACTIVE ACTION */}

                  {status ===
                    "active" && (

                    <div className="subscription-request-actions">

                      <button
                        type="button"
                        className="pause-subscription-button"
                        disabled={
                          isLoading
                        }
                        onClick={() =>
                          pauseSubscription(
                            subscription
                          )
                        }
                      >
                        {isLoading
                          ? "جاري التنفيذ..."
                          : "Ⅱ إيقاف الاشتراك"}
                      </button>

                    </div>
                  )}

                  {/* PAUSED ACTION */}

                  {status ===
                    "paused" && (

                    <div className="subscription-request-actions">

                      <button
                        type="button"
                        className="resume-subscription-button"
                        disabled={
                          isLoading
                        }
                        onClick={() =>
                          resumeSubscription(
                            subscription
                          )
                        }
                      >
                        {isLoading
                          ? "جاري التنفيذ..."
                          : "▶ استئناف الاشتراك"}
                      </button>

                    </div>
                  )}

                  {/* EXPIRED */}

                  {status ===
                    "expired" && (

                    <div className="subscription-request-notice expired">
                      انتهت مدة هذا الاشتراك.
                    </div>
                  )}

                  {/* REJECTED */}

                  {status ===
                    "rejected" && (

                    <div className="subscription-request-notice rejected">
                      تم رفض طلب الاشتراك.
                    </div>
                  )}

                </article>
              );
            }
          )}

        </div>
      )}

      {/* =================================================
          FOOTER
      ================================================= */}

      <div className="subscription-requests-footer">

        <span>
          ✦
        </span>

        <p>
          GYM COACH — إدارة الاشتراكات
          والعملاء
        </p>

        <span>
          ✦
        </span>

      </div>

    </div>
  );
}

export default SubscriptionRequests;