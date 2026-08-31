import { Navigate } from "react-router-dom";

function ProtectedRoute({
  children,
  allowedRoles,
}) {
  const token =
    localStorage.getItem("token");

  let user = null;

  try {
    user = JSON.parse(
      localStorage.getItem("user") ||
        "null"
    );
  } catch {
    user = null;
  }

  /*
    لا يوجد Token
  */

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /*
    لا توجد بيانات المستخدم
  */

  if (!user) {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /*
    إذا تم تحديد الأدوار المسموح بها
  */

  if (
    allowedRoles &&
    !allowedRoles.includes(
      user.role
    )
  ) {
    /*
      العميل يحاول دخول صفحة المدرب
    */

    if (
      user.role ===
      "client"
    ) {
      return (
        <Navigate
          to="/client-training"
          replace
        />
      );
    }

    /*
      المدرب أو أي مستخدم آخر
    */

    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;