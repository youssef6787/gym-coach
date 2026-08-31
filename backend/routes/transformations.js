
const express = require("express");
const path = require("path");
const multer = require("multer");

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
  deliveryTypeFromUrl,
  removeLocalFile,
} = require("../config/storage");

const router = express.Router();

/*
========================================================
RUNTIME / TEMP UPLOAD DIRECTORY
========================================================

Netlify:
- لا نستخدم backend/uploads أثناء تشغيل Function.
- /tmp هو المكان المسموح للملفات المؤقتة.

Local:
- نستخدم /tmp أيضًا.
- Cloudinary هو التخزين الدائم للصور.
========================================================
*/

const uploadDirectory =
  process.env.NETLIFY ||
  process.env.NETLIFY_FUNCTIONS_VERSION
    ? "/tmp/gym-coach-transformations"
    : path.join(
        require("os").tmpdir(),
        "gym-coach-transformations"
      );

/*
========================================================
MULTER
========================================================
*/

const storage =
  multer.diskStorage({
    destination: (
      _req,
      _file,
      cb
    ) => {
      cb(
        null,
        uploadDirectory
      );
    },

    filename: (
      _req,
      file,
      cb
    ) => {
      const extension =
        path
          .extname(
            file.originalname || ""
          )
          .toLowerCase();

      const uniqueName =
        `transformation-${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${extension}`;

      cb(
        null,
        uniqueName
      );
    },
  });

const fileFilter = (
  _req,
  file,
  cb
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
  ];

  if (
    allowedTypes.includes(
      file.mimetype
    )
  ) {
    return cb(
      null,
      true
    );
  }

  return cb(
    new Error(
      "نوع الصورة غير مسموح. استخدم JPG أو PNG أو WEBP."
    ),
    false
  );
};

const upload =
  multer({
    storage,
    fileFilter,

    limits: {
      fileSize:
        10 * 1024 * 1024,

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

const ALLOWED_TYPES = [
  "transformation",
  "work",
];

const normalizeText = (
  value
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
};

const normalizeBoolean = (
  value
) => {
  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return true;
  }

  return false;
};

/*
========================================================
CLEANUP LOCAL TEMP FILE
========================================================
*/

const cleanupUploadedFile = (
  file
) => {
  if (
    !file ||
    !file.path
  ) {
    return;
  }

  try {
    removeLocalFile(
      file.path
    );
  } catch {
    // ignore cleanup failure
  }
};

/*
========================================================
UPLOAD ERROR HANDLER
========================================================
*/

const handleUploadError = (
  error,
  req,
  res
) => {
  cleanupUploadedFile(
    req.file
  );

  if (
    error instanceof
    multer.MulterError
  ) {
    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "حجم الصورة يجب ألا يتجاوز 10MB",
      });
    }

    if (
      error.code ===
      "LIMIT_FILE_COUNT"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "يمكن رفع صورة واحدة فقط",
      });
    }

    return res.status(400).json({
      success: false,

      message:
        "تعذر معالجة ملف الصورة",
    });
  }

  if (error) {
    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "نوع الصورة غير مسموح",
    });
  }

  return null;
};

/*
========================================================
DELETE CLOUDINARY IMAGE
========================================================
*/

const deleteStoredImage = async (
  imageUrl
) => {
  if (!imageUrl) {
    return;
  }

  if (
    !cloudinaryEnabled
  ) {
    return;
  }

  const publicId =
    publicIdFromUrl(
      imageUrl
    );

  if (!publicId) {
    return;
  }

  const deliveryType =
    deliveryTypeFromUrl(
      imageUrl
    ) || "upload";

  try {
    await destroyFromCloudinary(
      publicId,
      "image",
      deliveryType
    );
  } catch (error) {
    console.error(
      "Delete Cloudinary transformation image error:",
      error
    );
  }
};

/*
========================================================
GET PUBLIC TRANSFORMATIONS
========================================================
*/

router.get(
  "/",
  async (_req, res) => {
    try {
      const [
        transformations,
      ] = await db.query(
        `
        SELECT
          id,
          title,
          description,
          image_url,
          type,
          created_at
        FROM transformations
        WHERE is_visible = 1
        ORDER BY id DESC
        `
      );

      return res.json({
        success: true,

        transformations,
      });
    } catch (error) {
      console.error(
        "Get public transformations error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "حدث خطأ أثناء جلب الصور",
      });
    }
  }
);

/*
========================================================
GET ADMIN TRANSFORMATIONS
========================================================
*/

router.get(
  "/admin",
  verifyToken,
  requireAdmin,

  async (_req, res) => {
    try {
      const [
        transformations,
      ] = await db.query(
        `
        SELECT
          id,
          title,
          description,
          image_url,
          type,
          is_visible,
          created_at
        FROM transformations
        ORDER BY id DESC
        `
      );

      return res.json({
        success: true,

        transformations,
      });
    } catch (error) {
      console.error(
        "Get admin transformations error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "حدث خطأ أثناء جلب التحولات",
      });
    }
  }
);

/*
========================================================
POST NEW TRANSFORMATION
========================================================
*/

router.post(
  "/",
  verifyToken,
  requireAdmin,

  (
    req,
    res,
    next
  ) => {
    upload.single(
      "image"
    )(
      req,
      res,
      (error) => {
        if (error) {
          return handleUploadError(
            error,
            req,
            res
          );
        }

        return next();
      }
    );
  },

  async (
    req,
    res
  ) => {
    try {
      /*
      ----------------------------------------
      Validate uploaded file
      ----------------------------------------
      */

      if (!req.file) {
        return res.status(400).json({
          success: false,

          message:
            "يجب اختيار صورة",
        });
      }

      /*
      ----------------------------------------
      Validate title
      ----------------------------------------
      */

      const title =
        normalizeText(
          req.body?.title
        );

      if (!title) {
        cleanupUploadedFile(
          req.file
        );

        return res.status(400).json({
          success: false,

          message:
            "يجب كتابة عنوان للصورة",
        });
      }

      if (
        title.length >
        200
      ) {
        cleanupUploadedFile(
          req.file
        );

        return res.status(400).json({
          success: false,

          message:
            "عنوان الصورة طويل جدًا",
        });
      }

      /*
      ----------------------------------------
      Description
      ----------------------------------------
      */

      const description =
        normalizeText(
          req.body?.description
        );

      if (
        description.length >
        2000
      ) {
        cleanupUploadedFile(
          req.file
        );

        return res.status(400).json({
          success: false,

          message:
            "وصف الصورة طويل جدًا",
        });
      }

      /*
      ----------------------------------------
      Type
      ----------------------------------------
      */

      const requestedType =
        normalizeText(
          req.body?.type
        );

      const imageType =
        ALLOWED_TYPES.includes(
          requestedType
        )
          ? requestedType
          : "transformation";

      /*
      ----------------------------------------
      Cloudinary is required
      for production persistence
      ----------------------------------------
      */

      if (
        !cloudinaryEnabled
      ) {
        cleanupUploadedFile(
          req.file
        );

        return res.status(500).json({
          success: false,

          message:
            "تخزين الصور غير مفعّل. تأكد من إعداد Cloudinary.",
        });
      }

      /*
      ----------------------------------------
      Store image in Cloudinary
      ----------------------------------------
      */

      let stored;

      try {
        stored =
          await storeUploadedFile(
            req.file,
            {
              resourceType:
                "image",

              folder:
                "gym-coach/transformations",

              /*
              التحولات صور عامة
              */

              deliveryType:
                "upload",
            }
          );
      } catch (storageError) {
        cleanupUploadedFile(
          req.file
        );

        console.error(
          "Store transformation image error:",
          storageError
        );

        return res.status(500).json({
          success: false,

          message:
            "تعذر حفظ الصورة في التخزين السحابي",
        });
      }

      const imageUrl =
        stored?.url;

      if (!imageUrl) {
        cleanupUploadedFile(
          req.file
        );

        return res.status(500).json({
          success: false,

          message:
            "لم يتم الحصول على رابط الصورة",
        });
      }

      /*
      ----------------------------------------
      Save in database
      ----------------------------------------
      */

      try {
        const [
          result,
        ] = await db.query(
          `
          INSERT INTO transformations
          (
            title,
            description,
            image_url,
            type,
            is_visible
          )

          VALUES (?, ?, ?, ?, 1)
          `,
          [
            title,

            description
              ? description
              : null,

            imageUrl,

            imageType,
          ]
        );

        cleanupUploadedFile(
          req.file
        );

        return res
          .status(201)
          .json({
            success: true,

            message:
              "تم رفع الصورة وإضافتها بنجاح",

            transformation: {
              id:
                result.insertId,

              title,

              description:
                description
                  ? description
                  : null,

              image_url:
                imageUrl,

              type:
                imageType,

              is_visible:
                true,
            },
          });
      } catch (dbError) {
        /*
        ----------------------------------------
        DB failed
        Delete Cloudinary asset
        ----------------------------------------
        */

        await deleteStoredImage(
          imageUrl
        );

        cleanupUploadedFile(
          req.file
        );

        throw dbError;
      }
    } catch (error) {
      cleanupUploadedFile(
        req.file
      );

      console.error(
        "Create transformation error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "حدث خطأ أثناء رفع الصورة",
      });
    }
  }
);

/*
========================================================
PUT UPDATE TRANSFORMATION
========================================================
*/

router.put(
  "/:id",
  verifyToken,
  requireAdmin,

  async (
    req,
    res
  ) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !isPositiveInteger(
          id
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "رقم الصورة غير صحيح",
        });
      }

      const [
        existingRows,
      ] = await db.query(
        `
        SELECT
          id,
          title,
          description,
          image_url,
          type,
          is_visible
        FROM transformations
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );

      if (
        existingRows.length ===
        0
      ) {
        return res.status(404).json({
          success: false,

          message:
            "الصورة غير موجودة",
        });
      }

      const existing =
        existingRows[0];

      const titleWasProvided =
        req.body?.title !==
        undefined;

      const descriptionWasProvided =
        req.body?.description !==
        undefined;

      const typeWasProvided =
        req.body?.type !==
        undefined;

      const visibilityWasProvided =
        req.body?.is_visible !==
        undefined;

      const title =
        titleWasProvided
          ? normalizeText(
              req.body.title
            )
          : existing.title;

      const description =
        descriptionWasProvided
          ? normalizeText(
              req.body.description
            )
          : existing.description;

      const type =
        typeWasProvided
          ? normalizeText(
              req.body.type
            )
          : existing.type;

      /*
      ----------------------------------------
      Validate title
      ----------------------------------------
      */

      if (!title) {
        return res.status(400).json({
          success: false,

          message:
            "عنوان الصورة مطلوب",
        });
      }

      if (
        title.length >
        200
      ) {
        return res.status(400).json({
          success: false,

          message:
            "عنوان الصورة طويل جدًا",
        });
      }

      /*
      ----------------------------------------
      Validate description
      ----------------------------------------
      */

      if (
        String(
          description || ""
        ).length >
        2000
      ) {
        return res.status(400).json({
          success: false,

          message:
            "وصف الصورة طويل جدًا",
        });
      }

      /*
      ----------------------------------------
      Validate type
      ----------------------------------------
      */

      if (
        !ALLOWED_TYPES.includes(
          type
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "نوع الصورة غير صحيح",
        });
      }

      /*
      ----------------------------------------
      Visibility
      ----------------------------------------
      */

      const visible =
        visibilityWasProvided
          ? normalizeBoolean(
              req.body.is_visible
            )
          : Boolean(
              existing.is_visible
            );

      await db.query(
        `
        UPDATE transformations

        SET
          title = ?,
          description = ?,
          type = ?,
          is_visible = ?

        WHERE id = ?
        `,
        [
          title,

          description
            ? description
            : null,

          type,

          visible
            ? 1
            : 0,

          id,
        ]
      );

      return res.json({
        success: true,

        message:
          "تم تعديل الصورة بنجاح",
      });
    } catch (error) {
      console.error(
        "Update transformation error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "حدث خطأ أثناء تعديل الصورة",
      });
    }
  }
);

/*
========================================================
DELETE TRANSFORMATION
========================================================
*/

router.delete(
  "/:id",
  verifyToken,
  requireAdmin,

  async (
    req,
    res
  ) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !isPositiveInteger(
          id
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "رقم الصورة غير صحيح",
        });
      }

      const [
        rows,
      ] = await db.query(
        `
        SELECT
          image_url

        FROM transformations

        WHERE id = ?

        LIMIT 1
        `,
        [id]
      );

      if (
        rows.length ===
        0
      ) {
        return res.status(404).json({
          success: false,

          message:
            "الصورة غير موجودة",
        });
      }

      const imageUrl =
        String(
          rows[0].image_url ||
            ""
        ).trim();

      /*
      ----------------------------------------
      Delete database record first
      ----------------------------------------
      */

      await db.query(
        `
        DELETE FROM transformations

        WHERE id = ?
        `,
        [id]
      );

      /*
      ----------------------------------------
      Delete Cloudinary asset
      ----------------------------------------
      */

      if (
        imageUrl
      ) {
        await deleteStoredImage(
          imageUrl
        );
      }

      return res.json({
        success: true,

        message:
          "تم حذف الصورة بنجاح",
      });
    } catch (error) {
      console.error(
        "Delete transformation error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "حدث خطأ أثناء حذف الصورة",
      });
    }
  }
);

/*
========================================================
TOGGLE VISIBILITY
========================================================
*/

router.patch(
  "/:id/visibility",
  verifyToken,
  requireAdmin,

  async (
    req,
    res
  ) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !isPositiveInteger(
          id
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "رقم الصورة غير صحيح",
        });
      }

      /*
      ----------------------------------------
      Validate requested value
      ----------------------------------------
      */

      if (
        typeof req.body?.is_visible !==
          "boolean" &&
        ![
          0,
          1,
          "0",
          "1",
          "true",
          "false",
        ].includes(
          req.body?.is_visible
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "قيمة حالة الظهور غير صحيحة",
        });
      }

      const isVisible =
        normalizeBoolean(
          req.body.is_visible
        );

      /*
      ----------------------------------------
      Make sure record exists
      ----------------------------------------
      */

      const [
        rows,
      ] = await db.query(
        `
        SELECT
          id

        FROM transformations

        WHERE id = ?

        LIMIT 1
        `,
        [id]
      );

      if (
        rows.length ===
        0
      ) {
        return res.status(404).json({
          success: false,

          message:
            "الصورة غير موجودة",
        });
      }

      await db.query(
        `
        UPDATE transformations

        SET is_visible = ?

        WHERE id = ?
        `,
        [
          isVisible
            ? 1
            : 0,

          id,
        ]
      );

      return res.json({
        success: true,

        message:
          isVisible
            ? "تم إظهار الصورة"
            : "تم إخفاء الصورة",
      });
    } catch (error) {
      console.error(
        "Toggle transformation visibility error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "حدث خطأ أثناء تغيير حالة الصورة",
      });
    }
  }
);

module.exports = router;
