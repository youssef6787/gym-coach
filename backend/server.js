process.on("uncaughtException", (error) => {
  console.error("❌ UNCAUGHT EXCEPTION:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
  process.exit(1);
});


const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const {
  NODE_ENV,
  PORT,
  isProduction,
  CORS_ORIGIN,
} = require("./config/env");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

// Keep error responses generic in production and avoid accidental body abuse.
app.use((req, res, next) => {
  res.setHeader("X-Request-ID", req.headers["x-request-id"] || require("crypto").randomUUID());
  next();
});

/*
========================================
SECURITY / CORS CONFIGURATION
========================================
*/

const configuredCorsOrigins = (
  CORS_ORIGIN ||
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isDevelopment =
  NODE_ENV !== "production";

/*
========================================
CORS
========================================
*/

const corsOptions = {
  origin: (origin, callback) => {
    /*
    الطلبات بدون Origin:
    curl / Postman / server-to-server
    */

    if (!origin) {
      return callback(null, true);
    }

    if (configuredCorsOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (!isProduction) {
      const localOrigins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ];

      if (localOrigins.includes(origin)) {
        return callback(null, true);
      }
    }

    return callback(new Error("Origin غير مسموح به"));
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Type",
  ],

  optionsSuccessStatus: 204,
};

app.use(
  cors(corsOptions)
);

app.options(
  /.*/,
  cors(corsOptions)
);

/*
========================================
HELMET
========================================
*/

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy:
        "cross-origin",
    },

    referrerPolicy: {
      policy:
        "strict-origin-when-cross-origin",
    },
  })
);

/*
========================================
RATE LIMIT CONFIGURATION
========================================
*/

/*
----------------------------------------
General API limiter
----------------------------------------

هذا الحد يحمي جميع طلبات /api.

تم رفع الحد من 300 إلى 1000
لأن الموقع يحتوي على:
- polling للدردشة
- polling للإشعارات
- تحميل بيانات متكرر
- تحديثات للواجهة
*/

const apiLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 1000,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success: false,

      message:
        "تم تجاوز عدد الطلبات المسموح بها. حاول مرة أخرى بعد قليل.",
    },
  });

/*
----------------------------------------
Authentication limiter
----------------------------------------

حماية قوية لتسجيل الدخول والتسجيل.
*/

const authLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 10,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success: false,

      message:
        "تم تجاوز عدد محاولات تسجيل الدخول أو التسجيل. حاول مرة أخرى بعد 15 دقيقة.",
    },
  });

/*
----------------------------------------
Sensitive action limiter
----------------------------------------

مهم جدًا:

هذا limiter لا يجب أن يحسب GET.

يطبق فقط على:
POST
PUT
PATCH
DELETE

حتى لا تتسبب طلبات تحميل البيانات
في استهلاك حد العمليات.
*/

const sensitiveWriteLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 120,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success: false,

      message:
        "تم تجاوز عدد العمليات المسموح بها. حاول مرة أخرى بعد قليل.",
    },
  });

/*
----------------------------------------
Middleware لتطبيق limiter
على عمليات الكتابة فقط
----------------------------------------
*/

const sensitiveWriteOnly = (
  req,
  res,
  next
) => {
  const writeMethods = [
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ];

  if (
    !writeMethods.includes(
      req.method
    )
  ) {
    return next();
  }

  return sensitiveWriteLimiter(
    req,
    res,
    next
  );
};

/*
----------------------------------------
Upload limiter
----------------------------------------

رفع الصور والفيديوهات.
*/

const uploadLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 20,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success: false,

      message:
        "تم تجاوز عدد عمليات الرفع المسموح بها. حاول مرة أخرى بعد قليل.",
    },
  });

/*
----------------------------------------
Chat limiter
----------------------------------------

الدردشة تعمل بالـpolling،
لذلك رفع الحد من 180 إلى 400.
*/

const chatLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 400,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success: false,

      message:
        "تم تجاوز عدد طلبات المحادثة المسموح بها. حاول مرة أخرى بعد قليل.",
    },
  });

/*
========================================
BODY PARSERS
========================================
*/

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

/*
========================================
GENERAL API RATE LIMIT
========================================
*/

app.use(
  "/api",
  apiLimiter
);

/*
========================================
ROUTES
========================================
*/

const authRoutes =
  require("./routes/auth");

const otpAuthRoutes =
  require("./routes/otpAuth");

const adminRoutes =
  require("./routes/admin");

const packageRoutes =
  require("./routes/packages");

const clientRoutes =
  require("./routes/clients");

const trainingRoutes =
  require("./routes/training");

const trainingDaysRoutes =
  require("./routes/trainingDays");

const exercisesRoutes =
  require("./routes/exercises");

const exerciseVideosRoutes =
  require("./routes/exerciseVideos");

const progressRoutes =
  require("./routes/progressRoutes");

const nutritionRoutes =
  require("./routes/nutrition");

const subscriptionRoutes =
  require("./routes/subscriptions");

const chatRoutes =
  require("./routes/chat");

const notificationsRoutes =
  require("./routes/notifications");

const transformationsRoutes =
  require("./routes/transformations");

const mediaRoutes =
  require("./routes/media");

/*
========================================
AUTH
========================================
*/

app.use("/api/auth", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/auth", otpAuthRoutes);

/*
========================================
ADMIN
========================================
*/

app.use(
  "/api/admin",
  sensitiveWriteOnly,
  adminRoutes
);

/*
========================================
PACKAGES
========================================
*/

app.use(
  "/api/packages",
  sensitiveWriteOnly,
  packageRoutes
);

/*
========================================
CLIENTS
========================================
*/

app.use(
  "/api/clients",
  sensitiveWriteOnly,
  clientRoutes
);

/*
========================================
TRAINING
========================================
*/

app.use(
  "/api/training",
  sensitiveWriteOnly,
  trainingRoutes
);

/*
========================================
TRAINING DAYS
========================================
*/

app.use(
  "/api/training-days",
  sensitiveWriteOnly,
  trainingDaysRoutes
);

/*
========================================
EXERCISES
========================================
*/

app.use(
  "/api/exercises",
  sensitiveWriteOnly,
  exercisesRoutes
);

/*
========================================
EXERCISE VIDEOS
========================================

رفع الفيديو:

POST /api/exercise-videos/upload
يخضع لـ uploadLimiter.

باقي عمليات الفيديو:
POST / PUT / PATCH / DELETE
تخضع لـ sensitiveWriteOnly.

GET لا يستهلك sensitive limiter.
*/

app.use(
  "/api/exercise-videos/upload",
  uploadLimiter
);

app.use(
  "/api/exercise-videos",
  sensitiveWriteOnly,
  exerciseVideosRoutes
);

/*
========================================
PROGRESS
========================================

GET /api/progress
لا يستهلك sensitive limiter.

POST / PUT / PATCH / DELETE
يستهلك sensitive limiter.
*/

app.use(
  "/api/progress",
  sensitiveWriteOnly,
  progressRoutes
);

/*
========================================
NUTRITION
========================================
*/

app.use(
  "/api/nutrition",
  sensitiveWriteOnly,
  nutritionRoutes
);

/*
========================================
SUBSCRIPTIONS
========================================

قراءة الاشتراك GET لا تستهلك
حد العمليات.

تغيير الاشتراك POST / PUT / PATCH / DELETE
يخضع للحد.
*/

app.use(
  "/api/subscriptions",
  sensitiveWriteOnly,
  subscriptionRoutes
);

/*
========================================
CHAT
========================================
*/

app.use(
  "/api/chat",
  chatLimiter
);

/*
----------------------------------------
Chat image upload limiter
----------------------------------------
*/

app.use(
  "/api/chat/image",
  uploadLimiter
);

app.use(
  "/api/chat",
  chatRoutes
);

/*
========================================
NOTIFICATIONS
========================================

GET الخاص بالإشعارات لا يستهلك
حد العمليات.

عمليات POST / PUT / PATCH / DELETE
تخضع للحد.
*/

app.use(
  "/api/notifications",
  sensitiveWriteOnly,
  notificationsRoutes
);

/*
========================================
TRANSFORMATIONS
========================================
*/

app.use(
  "/api/transformations",
  sensitiveWriteOnly,
  transformationsRoutes
);

/*
========================================
PROTECTED MEDIA
========================================

لا نحتاج لإضافة apiLimiter مرة ثانية
لأن /api يحتوي عليه بالفعل.

إضافة limiter ثاني هنا كانت ستجعل
طلبات الصور والفيديو تمر عبر
نفس limiter مرتين.
*/

app.use(
  "/api/media",
  mediaRoutes
);

/*
========================================
HEALTH CHECK
========================================
*/

app.get(
  "/",
  (req, res) => {
    return res.json({
      success: true,

      message: "Gym Coach API is working",
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  }
);

/*
========================================
HEALTH CHECK
========================================
*/

app.get("/api/health", async (req, res) => {
  try {
    const db = require("./config/db");
    await db.checkDatabaseConnection();
    return res.status(200).json({
      success: true,
      status: "ok",
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: "unhealthy",
    });
  }
});

/*
========================================
404
========================================
*/

app.use(
  (req, res) => {
    return res
      .status(404)
      .json({
        success: false,

        message:
          "الرابط غير موجود",
      });
  }
);

/*
========================================
ERROR HANDLER
========================================
*/

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    /*
    CORS error
    */

    if (
      err?.message ===
      "Origin غير مسموح به"
    ) {
      return res
        .status(403)
        .json({
          success: false,

          message:
            "الوصول من هذا المصدر غير مسموح به",
        });
    }

    /*
    Rate limit errors
    */

    if (
      err?.status === 429
    ) {
      return res
        .status(429)
        .json({
          success: false,

          message:
            err.message ||
            "تم تجاوز عدد الطلبات المسموح بها",
        });
    }

    /*
    General server error
    */

    console.error(
      "Server error:",
      err
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          isDevelopment
            ? (
                err?.message ||
                "حدث خطأ في السيرفر"
              )
            : "حدث خطأ في السيرفر",
      });
  }
);

/*
========================================
START SERVER
========================================
*/

let server = null;

server = app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `🚀 Gym Coach API running in ${NODE_ENV} mode on port ${PORT}`
    );
  }
);

const shutdown = (signal) => {
  console.log(
    `\n${signal} received. Shutting down gracefully...`
  );

  if (!server) {
    process.exit(0);
  }

  server.close(() => {
    const db = require("./config/db");

    if (typeof db.end === "function") {
      db.end().finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = {
  app,
  server,
};