import API_URL from "../config/api";

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import "./ClientLayout.css";

function ClientLayout() {
  const navigate = useNavigate();

  const [chatUnreadCount, setChatUnreadCount] =
    useState(0);

  const getUser = () => {
    try {
      return JSON.parse(
        localStorage.getItem("user") || "{}"
      );
    } catch {
      return {};
    }
  };

  const user = getUser();

  const token =
    localStorage.getItem("token") || "";

  /*
  ==================================================
  تسجيل الخروج
  ==================================================
  */

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("client");

    navigate("/login", {
      replace: true,
    });
  };

  /*
  ==================================================
  الحرف الأول من اسم العميل
  ==================================================
  */

  const getInitial = () => {
    if (!user?.name) {
      return "C";
    }

    return user.name
      .charAt(0)
      .toUpperCase();
  };

  /*
  ==================================================
  جلب عدد الرسائل غير المقروءة
  ==================================================
  */

  const loadChatUnreadCount =
    useCallback(async () => {
      if (
        !token ||
        user?.role !== "client"
      ) {
        setChatUnreadCount(0);
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/chat/unread/count`,
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (
          !response.ok ||
          !data.success
        ) {
          return;
        }

        const count =
          Number(
            data.unread_count ?? 0
          );

        setChatUnreadCount(
          Number.isFinite(count) &&
            count > 0
            ? count
            : 0
        );
      } catch {
        /*
        فشل تحديث الشارة لا يمنع العميل
        من استخدام باقي الموقع.
        */
      }
    }, [
      token,
      user?.role,
    ]);

  /*
  ==================================================
  تحديث الشارة كل 5 ثوانٍ
  ==================================================
  */

  useEffect(() => {
    if (
      !token ||
      user?.role !== "client"
    ) {
      setChatUnreadCount(0);
      return undefined;
    }

    loadChatUnreadCount();

    const interval =
      window.setInterval(
        loadChatUnreadCount,
        5000
      );

    const handleFocus = () => {
      loadChatUnreadCount();
    };

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      window.clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, [
    token,
    user?.role,
    loadChatUnreadCount,
  ]);

  /*
  ==================================================
  الصفحة الحالية
  ==================================================
  */

  useEffect(() => {
    if (
      window.location.pathname ===
      "/client/chat"
    ) {
      setChatUnreadCount(0);
    }
  }, []);

  /*
  ==================================================
  فتح الدردشة
  ==================================================
  */

  const handleChatClick = () => {
    setChatUnreadCount(0);

    navigate("/client/chat");
  };

  return (
    <div
      className="client-layout"
      dir="rtl"
    >
      {/* ========================================
          MOBILE HEADER
      ======================================== */}

      <header className="client-mobile-header">
        <div className="client-mobile-brand">
          <span>GYM</span>
          <strong>COACH</strong>
        </div>

        <div className="client-mobile-user">
          <div className="client-avatar">
            {getInitial()}
          </div>

          <div>
            <strong>
              {user?.name || "العميل"}
            </strong>

            <span>
              حساب العميل
            </span>
          </div>
        </div>
      </header>

      {/* ========================================
          SIDEBAR
      ======================================== */}

      <aside className="client-sidebar">
        {/* Logo */}

        <div className="client-sidebar-logo">
          <div className="client-logo-mark">
            GC
          </div>

          <div className="client-logo-text">
            <strong>GYM</strong>
            <span>COACH</span>
          </div>
        </div>

        {/* User */}

        <div className="client-sidebar-user">
          <div className="client-sidebar-avatar">
            {getInitial()}
          </div>

          <div className="client-sidebar-user-info">
            <strong>
              {user?.name || "العميل"}
            </strong>

            <span>
              عميل
            </span>
          </div>
        </div>

        {/* Navigation */}

        <nav className="client-sidebar-nav">
          <div className="client-nav-title">
            القائمة الرئيسية
          </div>

          {/* الرئيسية */}

          <NavLink
            to="/client"
            end
            className={({ isActive }) =>
              `client-nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span className="client-nav-icon">
              🏠
            </span>

            <span>
              الرئيسية
            </span>
          </NavLink>

          {/* التدريب */}

          <NavLink
            to="/client/training"
            className={({ isActive }) =>
              `client-nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span className="client-nav-icon">
              🏋️
            </span>

            <span>
              التدريب
            </span>
          </NavLink>

          {/* التغذية */}

          <NavLink
            to="/client/diet"
            className={({ isActive }) =>
              `client-nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span className="client-nav-icon">
              🥗
            </span>

            <span>
              النظام الغذائي
            </span>
          </NavLink>

          {/* التقدم */}

          <NavLink
            to="/client/progress"
            className={({ isActive }) =>
              `client-nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span className="client-nav-icon">
              📊
            </span>

            <span>
              التقدم
            </span>
          </NavLink>

          {/* الاشتراك */}

          <div className="client-nav-title">
            الاشتراك
          </div>

          <NavLink
            to="/client/packages"
            className={({ isActive }) =>
              `client-nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span className="client-nav-icon">
              💳
            </span>

            <span>
              الباقات
            </span>
          </NavLink>

          <NavLink
            to="/client/subscriptions"
            className={({ isActive }) =>
              `client-nav-link ${
                isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span className="client-nav-icon">
              🔄
            </span>

            <span>
              اشتراكي
            </span>
          </NavLink>

          {/* الدردشة */}

          <button
            type="button"
            className={`client-nav-link client-nav-chat-button ${
              window.location.pathname ===
              "/client/chat"
                ? "active"
                : ""
            }`}
            onClick={handleChatClick}
          >
            <span className="client-nav-icon">
              💬
            </span>

            <span>
              الدردشة مع المدرب
            </span>

            {chatUnreadCount > 0 && (
              <span
                className="client-nav-badge"
                aria-label={`لديك ${chatUnreadCount} رسالة غير مقروءة`}
              >
                {chatUnreadCount > 99
                  ? "99+"
                  : chatUnreadCount}
              </span>
            )}
          </button>
        </nav>

        {/* Sidebar Bottom */}

        <div className="client-sidebar-bottom">
          <div className="client-coach-card">
            <div className="client-coach-icon">
              💬
            </div>

            <div>
              <strong>
                تحتاج مساعدة؟
              </strong>

              <span>
                تواصل مع مدربك
              </span>
            </div>
          </div>

          <button
            type="button"
            className="client-logout-button"
            onClick={logout}
          >
            <span>
              🚪
            </span>

            <span>
              تسجيل الخروج
            </span>
          </button>
        </div>
      </aside>

      {/* ========================================
          MAIN
      ======================================== */}

      <main className="client-main">
        <div className="client-main-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default ClientLayout;

