import API_URL from "../config/api";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import ClientDetails from "./ClientDetails";

const subscriptionLabels = {
  active: "نشط",
  pending: "قيد المراجعة",
  rejected: "مرفوض",
  paused: "موقوف",
  expired: "منتهي",
};

const getSubscriptionState = (
  client
) => {
  const status =
    client.subscription_status;

  if (!status) {
    return "none";
  }

  if (
    status === "active" &&
    client.end_date &&
    new Date(
      client.end_date
    ).getTime() <= Date.now()
  ) {
    return "expired";
  }

  return status;
};

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
};

const formatMoney = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${new Intl.NumberFormat(
    "ar-EG"
  ).format(number)} ج.م`;
};

function Clients() {
  const [clients, setClients] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState("all");

  const [error, setError] =
    useState("");

  const [
    selectedClientId,
    setSelectedClientId,
  ] = useState(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const value = Number(
      params.get("client")
    );

    return Number.isInteger(
      value
    ) && value > 0
      ? value
      : null;
  });

  const token =
    localStorage.getItem(
      "token"
    ) || "";

  /*
  =====================================================
  فتح ملف العميل
  =====================================================
  */

  const openClientDetails = (
    clientId
  ) => {
    const url =
      `/clients?client=${clientId}`;

    window.history.pushState(
      {},
      "",
      url
    );

    setSelectedClientId(
      clientId
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /*
  =====================================================
  الرجوع للعملاء
  =====================================================
  */

  const closeClientDetails = () => {
    window.history.pushState(
      {},
      "",
      "/clients"
    );

    setSelectedClientId(
      null
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /*
  =====================================================
  التعامل مع زر Back في المتصفح
  =====================================================
  */

  useEffect(() => {
    const handlePopState =
      () => {
        const params =
          new URLSearchParams(
            window.location.search
          );

        const value = Number(
          params.get("client")
        );

        if (
          Number.isInteger(
            value
          ) &&
          value > 0
        ) {
          setSelectedClientId(
            value
          );
        } else {
          setSelectedClientId(
            null
          );
        }
      };

    window.addEventListener(
      "popstate",
      handlePopState
    );

    return () => {
      window.removeEventListener(
        "popstate",
        handlePopState
      );
    };
  }, []);

  /*
  =====================================================
  جلب العملاء
  =====================================================
  */

  const fetchClients =
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `${API_URL}/clients`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "حدث خطأ أثناء جلب العملاء"
          );
        }

        setClients(
          data.clients || []
        );
      } catch (requestError) {
        setError(
          requestError.message ||
            "حدث خطأ أثناء جلب العملاء"
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchClients();
  }, []);

  /*
  =====================================================
  حذف العميل
  =====================================================
  */

  const handleDelete =
    async (
      id,
      name
    ) => {
      const confirmed =
        window.confirm(
          `هل أنت متأكد من حذف العميل "${
            name ||
            "هذا العميل"
          }"؟\n\nسيتم حذف بيانات الاشتراكات والتدريب المرتبطة بالحساب إذا كانت موجودة.`
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/clients/${id}`,
            {
              method:
                "DELETE",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "حدث خطأ أثناء حذف العميل"
          );
        }

        setClients(
          (current) =>
            current.filter(
              (client) =>
                client.id !== id
            )
        );

        if (
          selectedClientId ===
          id
        ) {
          closeClientDetails();
        }

        alert(
          data.message ||
            "تم حذف العميل بنجاح"
        );
      } catch (requestError) {
        alert(
          requestError.message ||
            "حدث خطأ أثناء حذف العميل"
        );
      }
    };

  /*
  =====================================================
  البحث والفلترة
  =====================================================
  */

  const filteredClients =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return clients.filter(
        (client) => {
          const state =
            getSubscriptionState(
              client
            );

          const matchesFilter =
            filter === "all" ||
            state === filter;

          if (!matchesFilter) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            client.name,
            client.email,
            String(
              client.id
            ),
            client.package_name,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                String(
                  value
                )
                  .toLowerCase()
                  .includes(query)
            );
        }
      );
    }, [
      clients,
      search,
      filter,
    ]);

  /*
  =====================================================
  الإحصائيات
  =====================================================
  */

  const counts = useMemo(
    () => {
      return clients.reduce(
        (
          result,
          client
        ) => {
          const state =
            getSubscriptionState(
              client
            );

          result.all += 1;

          if (
            state === "active"
          ) {
            result.active += 1;
          }

          if (
            state === "pending"
          ) {
            result.pending += 1;
          }

          if (
            state === "expired"
          ) {
            result.expired += 1;
          }

          if (
            state === "none"
          ) {
            result.none += 1;
          }

          return result;
        },
        {
          all: 0,
          active: 0,
          pending: 0,
          expired: 0,
          none: 0,
        }
      );
    },
    [clients]
  );

  /*
  =====================================================
  إذا كان العميل محددًا
  =====================================================
  */

  if (selectedClientId) {
    return (
      <ClientDetails
        clientId={
          selectedClientId
        }
        onBack={
          closeClientDetails
        }
      />
    );
  }

  /*
  =====================================================
  الصفحة الرئيسية للعملاء
  =====================================================
  */

  return (
    <div className="clients-page">

      {/* HEADER */}

      <header className="clients-header clients-header-pro">

        <div>

          <span className="dashboard-eyebrow">
            CLIENT MANAGEMENT
          </span>

          <h1>
            إدارة العملاء
          </h1>

          <p>
            ابحث عن عملائك وتابع حالة
            الاشتراك والباقات الخاصة بهم.
          </p>

        </div>

        <button
          type="button"
          className="clients-refresh"
          onClick={
            fetchClients
          }
          disabled={
            loading
          }
        >
          {loading
            ? "جاري التحميل..."
            : "↻ تحديث العملاء"}
        </button>

      </header>

      {/* ERROR */}

      {error && (
        <div className="dashboard-alert">

          <span>
            ⚠️
          </span>

          <div>

            <strong>
              حدث خطأ
            </strong>

            <p>
              {error}
            </p>

          </div>

          <button
            type="button"
            onClick={
              fetchClients
            }
          >
            إعادة المحاولة
          </button>

        </div>
      )}

      {/* TOOLBAR */}

      <section className="clients-toolbar">

        <div className="clients-search-wrap">

          <span>
            ⌕
          </span>

          <input
            type="search"
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
            placeholder="ابحث بالاسم أو البريد أو رقم العميل..."
          />

        </div>

        <div className="clients-filter-tabs">

          {[
            [
              "all",
              `الكل (${counts.all})`,
            ],

            [
              "active",
              `نشط (${counts.active})`,
            ],

            [
              "pending",
              `معلق (${counts.pending})`,
            ],

            [
              "expired",
              `منتهي (${counts.expired})`,
            ],

            [
              "none",
              `بدون اشتراك (${counts.none})`,
            ],
          ].map(
            ([
              value,
              label,
            ]) => (
              <button
                type="button"
                key={value}
                className={
                  filter ===
                  value
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter(
                    value
                  )
                }
              >
                {label}
              </button>
            )
          )}

        </div>

      </section>

      {/* LOADING */}

      {loading ? (

        <div className="empty-clients">

          <div className="clients-loading-icon">
            ⏳
          </div>

          <h2>
            جاري تحميل العملاء...
          </h2>

          <p>
            لحظات ونجهز لك قائمة العملاء.
          </p>

        </div>

      ) : filteredClients.length ===
        0 ? (

        <div className="empty-clients">

          <div className="clients-loading-icon">
            👥
          </div>

          <h2>
            {clients.length ===
            0
              ? "لا يوجد عملاء حتى الآن"
              : "لا توجد نتائج"}
          </h2>

          <p>
            {clients.length ===
            0
              ? "عندما يقوم عميل بإنشاء حساب سيظهر هنا."
              : "جرب تغيير البحث أو فلتر الاشتراك."}
          </p>

        </div>

      ) : (

        <div className="clients-grid clients-grid-pro">

          {filteredClients.map(
            (client) => {
              const state =
                getSubscriptionState(
                  client
                );

              return (
                <article
                  className="client-card client-card-pro"
                  key={
                    client.id
                  }
                >

                  <div className="client-card-top">

                    <div className="client-avatar">

                      {(client.name ||
                        "ع")
                        .charAt(
                          0
                        )
                        .toUpperCase()}

                    </div>

                    <span
                      className={`status-badge status-${state}`}
                    >
                      {state ===
                      "none"
                        ? "بدون اشتراك"
                        : subscriptionLabels[
                            state
                          ] ||
                          state}
                    </span>

                  </div>

                  <h2>
                    {client.name ||
                      "بدون اسم"}
                  </h2>

                  <p className="client-email">
                    {client.email ||
                      "بدون بريد إلكتروني"}
                  </p>

                  <small>
                    رقم العميل: #
                    {client.id}
                  </small>

                  <div className="client-subscription-box">

                    <div>

                      <span>
                        الباقة الحالية
                      </span>

                      <strong>
                        {client.package_name ||
                          "لا توجد باقة"}
                      </strong>

                    </div>

                    <div>

                      <span>
                        السعر
                      </span>

                      <strong>
                        {formatMoney(
                          client.package_price
                        )}
                      </strong>

                    </div>

                    <div>

                      <span>
                        تاريخ البداية
                      </span>

                      <strong>
                        {formatDate(
                          client.start_date
                        )}
                      </strong>

                    </div>

                    <div>

                      <span>
                        تاريخ الانتهاء
                      </span>

                      <strong>
                        {formatDate(
                          client.end_date
                        )}
                      </strong>

                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="client-actions client-actions-pro">

                    <button
                      type="button"
                      className="client-details-open-button"
                      onClick={() =>
                        openClientDetails(
                          client.id
                        )
                      }
                    >
                      👤 عرض ملف العميل
                    </button>

                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        handleDelete(
                          client.id,
                          client.name
                        )
                      }
                    >
                      حذف العميل
                    </button>

                  </div>

                </article>
              );
            }
          )}

        </div>
      )}

    </div>
  );
}

export default Clients;