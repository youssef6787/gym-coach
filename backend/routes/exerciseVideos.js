const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const db = require("../config/db");

const {
  verifyToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const {
  cloudinaryEnabled,
  storeUploadedFile,
  destroyFromCloudinary,
  publicIdFromUrl,
  removeLocalFile,
  deliveryTypeFromUrl,
} = require("../config/storage");

const router = express.Router();

/*
========================================================
UPLOAD DIRECTORY
========================================================

Netlify Functions:
- /var/task is read-only
- /tmp is writable

Local development:
- use backend/uploads/exercises

========================================================
*/

const isNetlify =
  process.env.NETLIFY === "true" ||
  Boolean(process.env.NETLIFY_DEV);

const uploadDir = isNetlify
  ? path.join("/tmp", "gym-coach-exercises")
  : path.join(
      __dirname,
      "..",
      "uploads",
      "exercises"
    );

/*
========================================================
CREATE TEMPORARY UPLOAD DIRECTORY
========================================================
*/

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
      recursive: true,
    });
  }
} catch (error) {
  /*
  في Netlify لا نريد أن يؤدي فشل إنشاء المجلد
  إلى Crash للـFunction عند تحميل الملف.

  Multer سيعطي الخطأ المناسب عند محاولة الرفع.
  */
}

/*
========================================================
ALLOWED VIDEO TYPES
========================================================
*/

const allowedTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
];

/*
========================================================
MULTER STORAGE
========================================================
*/

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    /*
    نتأكد أن المجلد موجود قبل كل عملية رفع.
    */

    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, {
          recursive: true,
        });
      }

      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },

  filename: (_req, file, cb) => {
    const extension = path
      .extname(
        file.originalname || ""
      )
      .toLowerCase();

    const uniqueName =
      `exercise-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${extension}`;

    cb(null, uniqueName);
  },
});

/*
========================================================
MULTER FILTER
========================================================
*/

const fileFilter = (
  _req,
  file,
  cb
) => {
  if (
    allowedTypes.includes(
      file.mimetype
    )
  ) {
    return cb(null, true);
  }

  return cb(
    new Error(
      "نوع الفيديو غير مسموح. استخدم MP4 أو WebM أو MOV أو AVI."
    ),
    false
  );
};

/*
========================================================
MULTER
========================================================
*/

const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize:
      100 *
      1024 *
      1024,

    files: 1,
  },
});

/*
========================================================
HELPERS
========================================================
*/

const isPositiveInteger = (
  value
) => {
  return (
    Number.isInteger(value) &&
    value > 0
  );
};

/*
--------------------------------------------------------
Delete stored Cloudinary asset
--------------------------------------------------------
*/

const deleteStoredVideo = async (
  videoUrl
) => {
  if (!videoUrl) {
    return;
  }

  /*
  Cloudinary
  */

  if (cloudinaryEnabled) {
    const publicId =
      publicIdFromUrl(
        videoUrl
      );

    if (!publicId) {
      return;
    }

    const deliveryType =
      deliveryTypeFromUrl(
        videoUrl
      ) || "upload";

    try {
      await destroyFromCloudinary(
        publicId,
        "video",
        deliveryType
      );
    } catch {
      /*
      فشل تنظيف Cloudinary لا يجب
      أن يكسر العملية الأساسية.
      */
    }

    return;
  }

  /*
  Local development
  */

  if (
    String(
      videoUrl
    ).startsWith(
      "/uploads/exercises/"
    )
  ) {
    const filename =
      path.basename(
        videoUrl
      );

    removeLocalFile(
      path.join(
        uploadDir,
        filename
      )
    );
  }
};

/*
========================================================
POST /upload
========================================================
رفع فيديو وربطه بتمرين
========================================================
*/

router.post(
  "/upload",
  verifyToken,
  requireAdmin,

  /*
  معالجة Multer يدويًا حتى نعيد
  رسائل واضحة للمستخدم.
  */

  (req, res, next) => {
    upload.single(
      "video"
    )(
      req,
      res,
      (error) => {
        if (error) {
          removeLocalFile(
            req.file?.path
          );

          if (
            error instanceof
            multer.MulterError
          ) {
            if (
              error.code ===
              "LIMIT_FILE_SIZE"
            ) {
              return res
                .status(400)
                .json({
                  success:
                    false,

                  message:
                    "حجم الفيديو يجب ألا يتجاوز 100MB",
                });
            }

            if (
              error.code ===
              "LIMIT_FILE_COUNT"
            ) {
              return res
                .status(400)
                .json({
                  success:
                    false,

                  message:
                    "يمكن رفع فيديو واحد فقط",
                });
            }

            return res
              .status(400)
              .json({
                success:
                  false,

                message:
                  "تعذر معالجة ملف الفيديو",
              });
          }

          return res
            .status(400)
            .json({
              success:
                false,

              message:
                error.message ||
                "نوع الفيديو غير مسموح",
            });
        }

        return next();
      }
    );
  },

  async (
    req,
    res
  ) => {
    let storedNewVideo =
      null;

    try {
      /*
      ----------------------------------------
      Validate uploaded file
      ----------------------------------------
      */

      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "يرجى اختيار فيديو",
          });
      }

      /*
      ----------------------------------------
      Validate exercise ID
      ----------------------------------------
      */

      const exerciseId =
        Number(
          req.body?.exercise_id
        );

      if (
        !isPositiveInteger(
          exerciseId
        )
      ) {
        removeLocalFile(
          req.file.path
        );

        return res
          .status(400)
          .json({
            success: false,

            message:
              "رقم التمرين غير صحيح",
          });
      }

      /*
      ----------------------------------------
      Get exercise
      ----------------------------------------
      */

      const [
        exercises,
      ] = await db.query(
        `
        SELECT
          id,
          video_url
        FROM exercises
        WHERE id = ?
        LIMIT 1
        `,
        [exerciseId]
      );

      if (
        exercises.length ===
        0
      ) {
        removeLocalFile(
          req.file.path
        );

        return res
          .status(404)
          .json({
            success: false,

            message:
              "التمرين غير موجود",
          });
      }

      const oldVideo =
        exercises[0]
          .video_url ||
        null;

      /*
      ----------------------------------------
      Upload NEW video first
      ----------------------------------------
      */

      storedNewVideo =
        await storeUploadedFile(
          req.file,
          {
            resourceType:
              "video",

            folder:
              "gym-coach/exercises",

            deliveryType:
              "authenticated",

            localUrl:
              `/uploads/exercises/${req.file.filename}`,
          }
        );

      const newVideoUrl =
        storedNewVideo.url;

      /*
      ----------------------------------------
      Update database
      ----------------------------------------
      */

      try {
        await db.query(
          `
          UPDATE exercises
          SET video_url = ?
          WHERE id = ?
          `,
          [
            newVideoUrl,
            exerciseId,
          ]
        );
      } catch (dbError) {
        /*
        لو فشل MySQL بعد نجاح الرفع،
        نحذف الفيديو الجديد.
        */

        await deleteStoredVideo(
          newVideoUrl
        );

        throw dbError;
      }

      /*
      ----------------------------------------
      Delete OLD video only after
      successful DB update
      ----------------------------------------
      */

      if (
        oldVideo &&
        oldVideo !==
          newVideoUrl
      ) {
        await deleteStoredVideo(
          oldVideo
        );
      }

      /*
      ----------------------------------------
      Response
      ----------------------------------------
      */

      return res.json({
        success: true,

        message:
          "تم رفع الفيديو بنجاح",

        video_url:
          newVideoUrl,

        file_name:
          req.file.filename,

        exercise_id:
          exerciseId,
      });
    } catch (error) {
      /*
      لو بقي ملف محلي مؤقت
      يتم تنظيفه.
      */

      removeLocalFile(
        req.file?.path
      );

      console.error(
        "[Exercise Video Upload Error]",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "حدث خطأ أثناء رفع الفيديو",
        });
    }
  }
);

/*
========================================================
DELETE VIDEO
========================================================
*/

router.delete(
  "/:exerciseId",
  verifyToken,
  requireAdmin,

  async (
    req,
    res
  ) => {
    try {
      const exerciseId =
        Number(
          req.params
            .exerciseId
        );

      if (
        !isPositiveInteger(
          exerciseId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "رقم التمرين غير صحيح",
          });
      }

      /*
      ----------------------------------------
      Get current video
      ----------------------------------------
      */

      const [
        exercises,
      ] = await db.query(
        `
        SELECT
          id,
          video_url
        FROM exercises
        WHERE id = ?
        LIMIT 1
        `,
        [exerciseId]
      );

      if (
        exercises.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "التمرين غير موجود",
          });
      }

      const videoUrl =
        exercises[0]
          .video_url || null;

      /*
      ----------------------------------------
      Remove DB reference first
      ----------------------------------------
      */

      await db.query(
        `
        UPDATE exercises
        SET video_url = NULL
        WHERE id = ?
        `,
        [exerciseId]
      );

      /*
      ----------------------------------------
      Delete storage asset
      ----------------------------------------
      */

      if (videoUrl) {
        await deleteStoredVideo(
          videoUrl
        );
      }

      return res.json({
        success: true,

        message:
          "تم حذف فيديو التمرين",
      });
    } catch (error) {
      console.error(
        "[Exercise Video Delete Error]",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "حدث خطأ أثناء حذف الفيديو",
        });
    }
  }
);

module.exports = router;
