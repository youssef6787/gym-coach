import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import API_URL from "../config/api";
import "./NotificationBell.css";

const POLL_INTERVAL = 10000;

const iconByType = {
  message: "💬",
  subscription: "💳",
  subscription_approved: "✅",
  subscription_rejected: "❌",
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const wrapperRef = useRef(null);

  const [open, setOpen] =
    useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [loading, setLoading] =
    useState(false);

  /*
  =====================================================
  Load Notifications
  =====================================================
  */

  const loadNotifications =
    useCallback(
      async (
        silent = true
      ) => {
        const token =
          localStorage.getItem(
            "token"
          ) || "";

        if (!token) {
          return;
        }

        try {
          if (!silent) {
            setLoading(true);
          }

          const response =
            await fetch(
              `${API_URL}/notifications?limit=20`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            return;
          }

          setNotifications(
            Array.isArray(
              data.notifications
            )
              ? data.notifications
              : []
          );

          setUnreadCount(
            Number(
              data.unreadCount || 0
            )
          );
        } catch {
          /*
          لا نعرض أخطاء polling في Console
          حتى لا تمتلئ Console في Production.
          */
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      []
    );

  /*
  =====================================================
  Initial Load + Polling
  =====================================================
  */

  useEffect(() => {
    loadNotifications(false);

    const interval =
      window.setInterval(
        () => {
          loadNotifications(true);
        },
        POLL_INTERVAL
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [
    loadNotifications,
  ]);

  /*
  =====================================================
  Close Dropdown Outside
  =====================================================
  */

  useEffect(() => {
    const handleClickOutside =
      (event) => {
        if (
          wrapperRef.current &&
          !wrapperRef.current.contains(
            event.target
          )
        ) {
          setOpen(false);
        }
      };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);

  /*
  =====================================================
  Mark One Notification As Read
  =====================================================
  */

  const markRead = async (
    id
  ) => {
    const token =
      localStorage.getItem(
        "token"
      ) || "";

    if (!token || !id) {
      return;
    }

    try {
      await fetch(
        `${API_URL}/notifications/${id}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch {
      /*
      فشل تحديث حالة القراءة لا يجب
      أن يوقف تجربة المستخدم.
      */
    }
  };

  /*
  =====================================================
  Mark All Notifications As Read
  =====================================================
  */

  const markAllRead =
    async () => {
      const token =
        localStorage.getItem(
          "token"
        ) || "";

      if (
        !token ||
        unreadCount === 0
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/notifications/read-all`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

        if (response.ok) {
          setUnreadCount(0);

          setNotifications(
            (items) =>
              items.map(
                (item) => ({
                  ...item,
                  is_read: 1,
                  read: true,
                })
              )
          );
        }
      } catch {
        /*
        لا حاجة لتسجيل خطأ في Console
        لكل محاولة فاشلة في Production.
        */
      }
    };

  /*
  =====================================================
  Notification Click
  =====================================================
  */

  const handleNotificationClick =
    async (
      notification
    ) => {
      if (
        !Number(
          notification.is_read
        )
      ) {
        await markRead(
          notification.id
        );

        setNotifications(
          (items) =>
            items.map(
              (item) =>
                item.id ===
                notification.id
                  ? {
                      ...item,
                      is_read: 1,
                      read: true,
                    }
                  : item
            )
        );

        setUnreadCount(
          (count) =>
            Math.max(
              0,
              count - 1
            )
        );
      }

      setOpen(false);

      /*
      استخدام navigate بدل window.location
      يحافظ على تجربة SPA بدون إعادة تحميل كاملة.
      */

      if (
        notification.link
      ) {
        navigate(
          notification.link
        );
      }
    };

  /*
  =====================================================
  Admin Area Only
  =====================================================
  */

  const isAdminArea =
    location.pathname.startsWith(
      "/dashboard"
    ) ||
    location.pathname.startsWith(
      "/clients"
    ) ||
    location.pathname.startsWith(
      "/packages"
    ) ||
    location.pathname.startsWith(
      "/subscription-requests"
    ) ||
    location.pathname.startsWith(
      "/transformations"
    ) ||
    location.pathname.startsWith(
      "/admin-chat"
    );

  if (!isAdminArea) {
    return null;
  }

  /*
  =====================================================
  Render
  =====================================================
  */

  return (
    <div
      className="notification-bell-wrapper"
      ref={wrapperRef}
    >
      <button
        type="button"
        className={`notification-bell-button ${
          unreadCount > 0
            ? "has-unread"
            : ""
        }`}
        onClick={() =>
          setOpen(
            (value) =>
              !value
          )
        }
        aria-label="الإشعارات"
        aria-expanded={
          open
        }
      >
        <span className="notification-bell-icon">
          🔔
        </span>

        {unreadCount > 0 && (
          <span className="notification-bell-count">
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">

          {/* =================================================
              Header
          ================================================= */}

          <div className="notification-dropdown-header">

            <div>

              <strong>
                الإشعارات
              </strong>

              <span>
                {unreadCount
                  ? `${unreadCount} غير مقروء`
                  : "لا توجد إشعارات جديدة"}
              </span>

            </div>

            <button
              type="button"
              className="notification-read-all"
              onClick={
                markAllRead
              }
              disabled={
                unreadCount ===
                0
              }
            >
              قراءة الكل
            </button>

          </div>

          {/* =================================================
              Notification List
          ================================================= */}

          <div className="notification-list">

            {loading &&
            notifications.length ===
              0 ? (

              <div className="notification-empty">
                جاري تحميل الإشعارات...
              </div>

            ) : notifications.length ===
              0 ? (

              <div className="notification-empty">

                <span>
                  🔕
                </span>

                لا توجد إشعارات حاليًا

              </div>

            ) : (

              notifications.map(
                (
                  notification
                ) => (

                  <button
                    type="button"
                    key={
                      notification.id
                    }
                    className={`notification-item ${
                      Number(
                        notification.is_read
                      )
                        ? "read"
                        : "unread"
                    }`}
                    onClick={() =>
                      handleNotificationClick(
                        notification
                      )
                    }
                  >

                    <span className="notification-item-icon">

                      {iconByType[
                        notification
                          .type
                      ] ||
                        "🔔"}

                    </span>

                    <span className="notification-item-content">

                      <strong>
                        {
                          notification.title
                        }
                      </strong>

                      <span>
                        {
                          notification.message
                        }
                      </span>

                      <small>
                        {notification.created_at
                          ? new Date(
                              notification.created_at
                            ).toLocaleString(
                              "ar-EG"
                            )
                          : ""}
                      </small>

                    </span>

                    {!Number(
                      notification.is_read
                    ) && (
                      <span className="notification-unread-dot" />
                    )}

                  </button>

                )
              )

            )}

          </div>

        </div>
      )}

    </div>
  );
};

export default NotificationBell;