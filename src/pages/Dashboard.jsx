import API_URL from "../config/api";
import "./Dashboard.css";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

const emptyStats = {
  clients: 0,
  packages: 0,
  activeSubscriptions: 0,
  pendingSubscriptions: 0,
  expiredSubscriptions: 0,
  pausedSubscriptions: 0,
  transformations: 0,
  totalRevenue: 0,
  monthlyRevenue: 0,
  newClientsThisMonth: 0,
  expiringSoon: 0,
  totalSubscriptions: 0,
};

const emptySubscriptionStatus = {
  active: 0,
  pending: 0,
  paused: 0,
  expired: 0,
  rejected: 0,
};

const statusLabel = {
  active: "نشط",
  pending: "قيد المراجعة",
  rejected: "مرفوض",
  expired: "منتهي",
  paused: "موقوف",
};

const statusClass = {
  active: "active",
  pending: "pending",
  rejected: "rejected",
  expired: "expired",
  paused: "paused",
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ar-EG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatMoney = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0 ج.م";
  }

  return `${new Intl.NumberFormat("ar-EG").format(
    number
  )} ج.م`;
};

const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("ar-EG").format(
    number
  );
};

const formatDay = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "short",
    day: "numeric",
  }).format(date);
};

function Dashboard() {
  const user = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("user") || "{}"
      );
    } catch {
      return {};
    }
  }, []);

  const [stats, setStats] =
    useState(emptyStats);

  const [
    subscriptionStatus,
    setSubscriptionStatus,
  ] = useState(
    emptySubscriptionStatus
  );

  const [
    recentSubscriptions,
    setRecentSubscriptions,
  ] = useState([]);

  const [
    recentClients,
    setRecentClients,
  ] = useState([]);

  const [
    expiringSoonSubscriptions,
    setExpiringSoonSubscriptions,
  ] = useState([]);

  const [
    popularPackages,
    setPopularPackages,
  ] = useState([]);

  const [
    subscriptionActivity,
    setSubscriptionActivity,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const token =
    localStorage.getItem("token") || "";

  /*
  =====================================================
  Load Dashboard
  =====================================================
  */

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/admin/dashboard`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "تعذر تحميل لوحة التحكم"
        );
      }

      setStats({
        ...emptyStats,
        ...(data.stats || {}),
      });

      setSubscriptionStatus({
        ...emptySubscriptionStatus,
        ...(data.subscriptionStatus || {}),
      });

      setRecentSubscriptions(
        data.recentSubscriptions || []
      );

      setRecentClients(
        data.recentClients || []
      );

      setExpiringSoonSubscriptions(
        data.expiringSoonSubscriptions || []
      );

      setPopularPackages(
        data.popularPackages || []
      );

      setSubscriptionActivity(
        data.subscriptionActivity || []
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          "حدث خطأ أثناء تحميل البيانات"
      );
    } finally {
      setLoading(false);
    }
  };

  /*
  =====================================================
  Initial Load
  =====================================================
  */

  useEffect(() => {
    loadDashboard();
  }, []);

  /*
  =====================================================
  Logout
  =====================================================
  */

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/login";
  };

  /*
  =====================================================
  Basic Stats Cards
  =====================================================
  */

  const cards = [
    {
      title: "العملاء",
      value: stats.clients,
      icon: "👥",
      link: "/clients",
      text: "إدارة جميع العملاء",
    },

    {
      title: "الاشتراكات النشطة",
      value:
        stats.activeSubscriptions,
      icon: "✅",
      link:
        "/subscription-requests",
      text: "الاشتراكات الحالية",
    },

    {
      title: "طلبات معلقة",
      value:
        stats.pendingSubscriptions,
      icon: "⏳",
      link:
        "/subscription-requests",
      text: "طلبات تحتاج مراجعة",
    },

    {
      title: "الباقات",
      value: stats.packages,
      icon: "📦",
      link: "/packages",
      text: "إدارة الأسعار والباقات",
    },

    {
      title: "الاشتراكات المنتهية",
      value:
        stats.expiredSubscriptions,
      icon: "⚠️",
      link:
        "/subscription-requests",
      text: "عملاء يحتاجون تجديد",
    },

    {
      title: "التحولات",
      value:
        stats.transformations,
      icon: "📸",
      link: "/transformations",
      text: "نتائج العملاء وأعمالك",
    },
  ];

  /*
  =====================================================
  Activity Max
  =====================================================
  */

  const maxActivity = Math.max(
    1,
    ...subscriptionActivity.map(
      (item) =>
        Number(item.total || 0)
    )
  );

  /*
  =====================================================
  Popular Package Max
  =====================================================
  */

  const maxPopularPackage =
    Math.max(
      1,
      ...popularPackages.map(
        (item) =>
          Number(
            item.subscriptions_count ||
              0
          )
      )
    );

  /*
  =====================================================
  Subscription Status Total
  =====================================================
  */

  const statusTotal =
    Object.values(
      subscriptionStatus
    ).reduce(
      (sum, value) =>
        sum +
        Number(value || 0),
      0
    );

  /*
  =====================================================
  Render
  =====================================================
  */

  return (
    <div className="dashboard-page">

      {/* =====================================================
          Header
      ===================================================== */}

      <header className="dashboard-header dashboard-header-pro">

        <div>

          <span className="dashboard-eyebrow">
            GYM COACH / ADMIN
          </span>

          <h1>
            لوحة تحكم المدرب
          </h1>

          <p>
            أهلاً بك{" "}
            {user?.name ||
              "مدرب الجيم"}{" "}
            — من هنا تقدر تدير عملائك،
            الباقات والاشتراكات.
          </p>

        </div>

        <div className="dashboard-header-actions">

          {/* =================================================
              Refresh
          ================================================= */}

          <button
            type="button"
            className="dashboard-refresh"
            onClick={
              loadDashboard
            }
            disabled={loading}
          >
            {loading
              ? "جاري التحديث..."
              : "↻ تحديث"}
          </button>

          {/* =================================================
              Logout
          ================================================= */}

          <button
            type="button"
            className="dashboard-logout"
            onClick={
              handleLogout
            }
          >
            تسجيل الخروج
          </button>

        </div>

      </header>


      {/* =====================================================
          Error
      ===================================================== */}

      {error && (
        <div className="dashboard-alert">

          <span>
            ⚠️
          </span>

          <div>

            <strong>
              تعذر تحميل بعض البيانات
            </strong>

            <p>
              {error}
            </p>

          </div>

          <button
            type="button"
            onClick={
              loadDashboard
            }
          >
            إعادة المحاولة
          </button>

        </div>
      )}


      {/* =====================================================
          Basic Statistics
      ===================================================== */}

      <section className="dashboard-stats-grid">

        {cards.map(
          (card) => (
            <Link
              to={card.link}
              className="dashboard-stat-card"
              key={card.title}
            >

              <div className="dashboard-stat-top">

                <span className="dashboard-stat-icon">
                  {card.icon}
                </span>

                <span className="dashboard-stat-arrow">
                  ↗
                </span>

              </div>

              <div className="dashboard-stat-value">

                {loading
                  ? "..."
                  : formatNumber(
                      card.value
                    )}

              </div>

              <h2>
                {card.title}
              </h2>

              <p>
                {card.text}
              </p>

            </Link>
          )
        )}

      </section>


      {/* =====================================================
          Finance
      ===================================================== */}

      <section className="dashboard-finance-grid">

        <div className="dashboard-finance-card">

          <div className="dashboard-finance-icon">
            💰
          </div>

          <div>

            <span>
              إجمالي الإيرادات
            </span>

            <strong>
              {loading
                ? "..."
                : formatMoney(
                    stats.totalRevenue
                  )}
            </strong>

            <small>
              من الاشتراكات المقبولة
            </small>

          </div>

        </div>


        <div className="dashboard-finance-card">

          <div className="dashboard-finance-icon">
            💵
          </div>

          <div>

            <span>
              إيرادات هذا الشهر
            </span>

            <strong>
              {loading
                ? "..."
                : formatMoney(
                    stats.monthlyRevenue
                  )}
            </strong>

            <small>
              خلال الشهر الحالي
            </small>

          </div>

        </div>


        <div className="dashboard-finance-card">

          <div className="dashboard-finance-icon">
            👤
          </div>

          <div>

            <span>
              عملاء جدد هذا الشهر
            </span>

            <strong>
              {loading
                ? "..."
                : formatNumber(
                    stats.newClientsThisMonth
                  )}
            </strong>

            <small>
              عملاء قاموا بالتسجيل
            </small>

          </div>

        </div>


        <div className="dashboard-finance-card">

          <div className="dashboard-finance-icon">
            🔔
          </div>

          <div>

            <span>
              تنتهي خلال 7 أيام
            </span>

            <strong>
              {loading
                ? "..."
                : formatNumber(
                    stats.expiringSoon
                  )}
            </strong>

            <small>
              تحتاج متابعة وتجديد
            </small>

          </div>

        </div>

      </section>


      {/* =====================================================
          Quick Actions
      ===================================================== */}

      <section className="dashboard-quick-actions">

        <div>

          <span className="dashboard-eyebrow">
            إجراءات سريعة
          </span>

          <h2>
            ابدأ من هنا
          </h2>

        </div>

        <div className="dashboard-action-buttons">

          <Link
            to="/packages"
            className="dashboard-action primary"
          >
            + إضافة باقة
          </Link>

          <Link
            to="/transformations"
            className="dashboard-action"
          >
            📸 إضافة تحول
          </Link>

        </div>

      </section>


      {/* =====================================================
          Expiring Subscriptions
      ===================================================== */}

      <section className="dashboard-panel dashboard-expiring-panel">

        <div className="dashboard-panel-header">

          <div>

            <span className="dashboard-eyebrow">
              تنبيه مهم
            </span>

            <h2>
              اشتراكات تنتهي خلال 7 أيام
            </h2>

          </div>

          <Link
            to="/subscription-requests"
          >
            إدارة الاشتراكات
          </Link>

        </div>


        {expiringSoonSubscriptions.length ===
        0 ? (

          <div className="dashboard-empty">

            <span className="dashboard-empty-icon">
              🎉
            </span>

            لا توجد اشتراكات ستنتهي
            خلال الأيام القادمة.

          </div>

        ) : (

          <div className="dashboard-expiring-list">

            {expiringSoonSubscriptions.map(
              (subscription) => (

                <Link
                  key={
                    subscription.id
                  }
                  to="/subscription-requests"
                  className="dashboard-expiring-row"
                >

                  <div className="dashboard-expiring-avatar">

                    {(
                      subscription.client_name ||
                      "ع"
                    ).charAt(0)}

                  </div>

                  <div className="dashboard-expiring-info">

                    <strong>
                      {
                        subscription.client_name ||
                        "عميل"
                      }
                    </strong>

                    <span>
                      {
                        subscription.package_name ||
                        "بدون باقة"
                      }
                    </span>

                  </div>

                  <div className="dashboard-expiring-date">

                    <strong>
                      {formatDate(
                        subscription.end_date
                      )}
                    </strong>

                    <span>
                      متبقي{" "}
                      {formatNumber(
                        subscription.remaining_days
                      )}{" "}
                      يوم
                    </span>

                  </div>

                  <span className="dashboard-expiring-arrow">
                    ←
                  </span>

                </Link>

              )
            )}

          </div>

        )}

      </section>


      {/* =====================================================
          Analytics
      ===================================================== */}

      <div className="dashboard-columns dashboard-analytics-columns">

        {/* ===================================================
            Subscription Status
        =================================================== */}

        <section className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>

              <span className="dashboard-eyebrow">
                التحليلات
              </span>

              <h2>
                حالة الاشتراكات
              </h2>

            </div>

            <span className="dashboard-panel-total">

              {formatNumber(
                statusTotal
              )}{" "}
              اشتراك

            </span>

          </div>


          <div className="dashboard-status-list">

            {[
              {
                key: "active",
                label: "نشط",
                icon: "🟢",
              },

              {
                key: "pending",
                label:
                  "قيد المراجعة",
                icon: "🟡",
              },

              {
                key: "paused",
                label: "موقوف",
                icon: "⏸️",
              },

              {
                key: "expired",
                label: "منتهي",
                icon: "🔴",
              },

              {
                key: "rejected",
                label: "مرفوض",
                icon: "⚫",
              },
            ].map(
              (item) => {

                const value =
                  Number(
                    subscriptionStatus[
                      item.key
                    ] || 0
                  );

                const percentage =
                  statusTotal >
                  0
                    ? Math.round(
                        (value /
                          statusTotal) *
                          100
                      )
                    : 0;

                return (
                  <div
                    className="dashboard-status-row"
                    key={
                      item.key
                    }
                  >

                    <div className="dashboard-status-label">

                      <span>
                        {
                          item.icon
                        }
                      </span>

                      <strong>
                        {
                          item.label
                        }
                      </strong>

                    </div>

                    <div className="dashboard-status-progress">

                      <div className="dashboard-status-track">

                        <div
                          className={`dashboard-status-fill dashboard-status-${item.key}`}
                          style={{
                            width: `${percentage}%`,
                          }}
                        />

                      </div>

                    </div>

                    <div className="dashboard-status-number">

                      {formatNumber(
                        value
                      )}

                      <small>
                        {
                          percentage
                        }%
                      </small>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </section>


        {/* ===================================================
            Popular Packages
        =================================================== */}

        <section className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>

              <span className="dashboard-eyebrow">
                الباقات
              </span>

              <h2>
                أكثر الباقات اشتراكًا
              </h2>

            </div>

            <Link to="/packages">
              إدارة الباقات
            </Link>

          </div>


          {popularPackages.length ===
          0 ? (

            <div className="dashboard-empty">
              لا توجد بيانات اشتراكات
              للباقات حتى الآن.
            </div>

          ) : (

            <div className="dashboard-popular-packages">

              {popularPackages.map(
                (
                  pkg,
                  index
                ) => {

                  const count =
                    Number(
                      pkg.subscriptions_count ||
                        0
                    );

                  const percentage =
                    Math.round(
                      (count /
                        maxPopularPackage) *
                        100
                    );

                  return (
                    <div
                      className="dashboard-popular-package"
                      key={
                        pkg.id
                      }
                    >

                      <div className="dashboard-popular-rank">
                        {index +
                          1}
                      </div>

                      <div className="dashboard-popular-info">

                        <div className="dashboard-popular-top">

                          <strong>
                            {
                              pkg.name ||
                              "باقة"
                            }
                          </strong>

                          <span>
                            {formatMoney(
                              pkg.price
                            )}
                          </span>

                        </div>

                        <div className="dashboard-popular-track">

                          <div
                            className="dashboard-popular-fill"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />

                        </div>

                        <small>
                          {formatNumber(
                            count
                          )}{" "}
                          مشترك
                        </small>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>

      </div>


      {/* =====================================================
          Subscription Activity
      ===================================================== */}

      <section className="dashboard-panel dashboard-activity-panel">

        <div className="dashboard-panel-header">

          <div>

            <span className="dashboard-eyebrow">
              النشاط
            </span>

            <h2>
              نشاط الاشتراكات خلال آخر 7 أيام
            </h2>

          </div>

          <span className="dashboard-panel-total">

            {formatNumber(
              subscriptionActivity.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  Number(
                    item.total ||
                      0
                  ),
                0
              )
            )}{" "}
            طلب

          </span>

        </div>


        {subscriptionActivity.length ===
        0 ? (

          <div className="dashboard-empty">
            لا يوجد نشاط اشتراكات خلال
            الأيام الأخيرة.
          </div>

        ) : (

          <div className="dashboard-activity-chart">

            {subscriptionActivity.map(
              (item) => {

                const value =
                  Number(
                    item.total ||
                      0
                  );

                const height =
                  Math.max(
                    value >
                      0
                      ? 12
                      : 4,

                    Math.round(
                      (value /
                        maxActivity) *
                        100
                    )
                  );

                return (
                  <div
                    className="dashboard-activity-item"
                    key={
                      item.date
                    }
                  >

                    <div className="dashboard-activity-value">

                      {formatNumber(
                        value
                      )}

                    </div>

                    <div className="dashboard-activity-bar-wrap">

                      <div
                        className="dashboard-activity-bar"
                        style={{
                          height: `${height}%`,
                        }}
                      />

                    </div>

                    <span>
                      {formatDay(
                        item.date
                      )}
                    </span>

                  </div>
                );
              }
            )}

          </div>

        )}

      </section>


      {/* =====================================================
          Recent Subscriptions / Clients
      ===================================================== */}

      <div className="dashboard-columns">

        {/* ===================================================
            Recent Subscriptions
        =================================================== */}

        <section className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>

              <span className="dashboard-eyebrow">
                آخر النشاطات
              </span>

              <h2>
                آخر طلبات الاشتراك
              </h2>

            </div>

            <Link
              to="/subscription-requests"
            >
              عرض الكل
            </Link>

          </div>


          {recentSubscriptions.length ===
          0 ? (

            <div className="dashboard-empty">
              لا توجد طلبات اشتراك حتى
              الآن.
            </div>

          ) : (

            <div className="dashboard-table-wrap">

              <table className="dashboard-table">

                <thead>

                  <tr>

                    <th>
                      العميل
                    </th>

                    <th>
                      الباقة
                    </th>

                    <th>
                      السعر
                    </th>

                    <th>
                      الحالة
                    </th>

                    <th>
                      التاريخ
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {recentSubscriptions.map(
                    (subscription) => (

                      <tr
                        key={
                          subscription.id
                        }
                      >

                        <td>

                          <strong>
                            {
                              subscription.client_name ||
                              "عميل"
                            }
                          </strong>

                          <small>
                            {
                              subscription.client_email ||
                              ""
                            }
                          </small>

                        </td>

                        <td>
                          {
                            subscription.package_name ||
                            "—"
                          }
                        </td>

                        <td>
                          {formatMoney(
                            subscription.package_price
                          )}
                        </td>

                        <td>

                          <span
                            className={`status-badge status-${
                              statusClass[
                                subscription.status
                              ] ||
                              subscription.status
                            }`}
                          >

                            {statusLabel[
                              subscription.status
                            ] ||
                              subscription.status ||
                              "—"}

                          </span>

                        </td>

                        <td>
                          {formatDate(
                            subscription.created_at
                          )}
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* ===================================================
            Recent Clients
        =================================================== */}

        <section className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>

              <span className="dashboard-eyebrow">
                العملاء
              </span>

              <h2>
                آخر العملاء
              </h2>

            </div>

            <Link to="/clients">
              إدارة العملاء
            </Link>

          </div>


          {recentClients.length ===
          0 ? (

            <div className="dashboard-empty">
              لا يوجد عملاء حتى الآن.
            </div>

          ) : (

            <div className="dashboard-client-list">

              {recentClients.map(
                (client) => (

                  <Link
                    to="/clients"
                    className="dashboard-client-row"
                    key={
                      client.id
                    }
                  >

                    <div className="dashboard-client-avatar">

                      {(
                        client.name ||
                        "ع"
                      ).charAt(
                        0
                      )}

                    </div>

                    <div>

                      <strong>
                        {
                          client.name ||
                          "عميل"
                        }
                      </strong>

                      <span>
                        {
                          client.email ||
                          "بدون بريد إلكتروني"
                        }
                      </span>

                    </div>

                    <span className="dashboard-client-arrow">
                      ←
                    </span>

                  </Link>

                )
              )}

            </div>

          )}

        </section>

      </div>

    </div>
  );
}

export default Dashboard;