import React from "react";
import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import NotificationBell from "./NotificationBell";

import "./AdminLayout.css";

function AdminLayout() {
  const navigate = useNavigate();

  /*
  ========================================
  تسجيل الخروج
  ========================================
  */

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
  };

  /*
  ========================================
  تنسيق روابط القائمة
  ========================================
  */

  const getLinkClass = ({ isActive }) => {
    return isActive
      ? "admin-sidebar-link active"
      : "admin-sidebar-link";
  };

  return (
    <div
      className="admin-layout trainer-platform-layout"
      dir="rtl"
    >

      {/* =====================================
          الإشعارات
      ====================================== */}

      <NotificationBell />


      {/* =====================================
          القائمة الجانبية
      ====================================== */}

      <aside className="admin-sidebar">

        {/* =====================================
            الشعار
        ====================================== */}

        <div className="admin-sidebar-brand">

          <div className="admin-brand-logo">
            JC
          </div>

          <div className="admin-brand-text">

            <strong>
              GYM
            </strong>

            <span>
              COACH
            </span>

          </div>

        </div>


        {/* =====================================
            بيانات المدرب
        ====================================== */}

        <div className="admin-profile">

          <div className="admin-profile-avatar">
            👤
          </div>

          <div>

            <strong>
              لوحة المدرب
            </strong>

            <span>
              ADMIN PANEL
            </span>

          </div>

        </div>


        {/* =====================================
            القائمة الرئيسية
            هذه المنطقة هي التي تعمل Scroll
        ====================================== */}

        <nav className="admin-sidebar-nav">

          {/* عنوان القائمة */}

          <div className="admin-nav-title">
            القائمة الرئيسية
          </div>


          {/* =====================================
              الرئيسية
          ====================================== */}

          <NavLink
            to="/dashboard"
            className={getLinkClass}
          >

            <span className="admin-nav-icon">
              🏠
            </span>

            <span>
              الرئيسية
            </span>

          </NavLink>


          {/* =====================================
              العملاء
          ====================================== */}

          <NavLink
            to="/clients"
            className={getLinkClass}
          >

            <span className="admin-nav-icon">
              👥
            </span>

            <span>
              العملاء
            </span>

          </NavLink>


          {/* =====================================
              طلبات الاشتراك
          ====================================== */}

          <NavLink
            to="/subscription-requests"
            className={getLinkClass}
          >

            <span className="admin-nav-icon">
              💳
            </span>

            <span>
              طلبات الاشتراك
            </span>

          </NavLink>


          {/* =====================================
              التحولات
          ====================================== */}

          <NavLink
            to="/transformations"
            className={getLinkClass}
          >

            <span className="admin-nav-icon">
              📸
            </span>

            <span>
              التحولات
            </span>

          </NavLink>


          {/* =====================================
              الباقات
          ====================================== */}

          <NavLink
            to="/packages"
            className={getLinkClass}
          >

            <span className="admin-nav-icon">
              📦
            </span>

            <span>
              الباقات
            </span>

          </NavLink>


          {/* =====================================
              الدردشة
          ====================================== */}

          <NavLink
            to="/admin-chat"
            className={getLinkClass}
          >

            <span className="admin-nav-icon">
              💬
            </span>

            <span>
              الدردشة
            </span>

          </NavLink>


          {/* =====================================
              يمكن إضافة روابط أخرى هنا
              وستدخل تلقائيًا داخل الـ Scroll
          ====================================== */}

          {/* مثال:

          <NavLink
            to="/settings"
            className={getLinkClass}
          >
            <span className="admin-nav-icon">
              ⚙️
            </span>

            <span>
              الإعدادات
            </span>
          </NavLink>

          */}

        </nav>


        {/* =====================================
            الجزء السفلي
            تسجيل الخروج ثابت
        ====================================== */}

        <div className="admin-sidebar-bottom">

          <div className="admin-sidebar-divider" />

          <button
            type="button"
            className="admin-logout-button"
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


      {/* =====================================
          محتوى الصفحات
      ====================================== */}

      <main className="admin-main-content">

        <Outlet />

      </main>

    </div>
  );
}

export default AdminLayout;