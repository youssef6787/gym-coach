const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

/*
=========================================================
VERIFY JWT TOKEN
=========================================================
*/

function verifyToken(
  req,
  res,
  next
) {
  try {
    const authHeader =
      req.headers.authorization;

    /*
    يجب أن يكون Authorization:
    Bearer <token>
    */

    if (
      typeof authHeader !== "string" ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "غير مصرح لك بالدخول",
        });
    }

    const token =
      authHeader
        .slice(7)
        .trim();

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "غير مصرح لك بالدخول",
        });
    }

    /*
    التحقق من التوكن
    */

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    /*
    تأكيد أن الـpayload
    يحتوي على بيانات مستخدم
    */

    if (
      !decoded ||
      typeof decoded !== "object" ||
      !decoded.id ||
      !decoded.role
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Token غير صالح",
        });
    }

    req.user = decoded;

    return next();
  } catch {
    return res
      .status(401)
      .json({
        success: false,
        message:
          "Token غير صالح أو منتهي",
      });
  }
}

/*
=========================================================
REQUIRE ADMIN
=========================================================
*/

function requireAdmin(
  req,
  res,
  next
) {
  if (
    !req.user ||
    req.user.role !==
      "admin"
  ) {
    return res
      .status(403)
      .json({
        success: false,
        message:
          "هذه العملية خاصة بالمدرب",
      });
  }

  return next();
}

module.exports = {
  verifyToken,
  requireAdmin,
};