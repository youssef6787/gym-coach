
const express = require("express");
const path = require("path");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const db = require("../config/db");
const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  createNotification,
} = require("../utils/notifications");

const {
  storeUploadedFile,
  removeLocalFile,
} = require("../config/storage");

const router = express.Router();

/*
=========================================================
CHAT IMAGE RATE LIMITER
=========================================================
*/

const chatImageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 30,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message: {
    success: false,

    message:
      "تم تجاوز عدد عمليات رفع الصور المسموح بها. حاول مرة أخرى بعد قليل.",
  },
});

/*
=========================================================
CHAT AUTHORIZATION HELPERS
=========================================================
*/

const getChatUser = async (userId) => {
  const [rows] = await db.query(
    `
    SELECT
      id,
      name,
      role
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
};

const canChatWith = (
  currentUser,
  otherUser
) => {
  if (!currentUser || !otherUser) {
    return false;
  }

  /*
  المدرب يستطيع التواصل مع العملاء فقط
  */

  if (currentUser.role === "admin") {
    return otherUser.role === "client";
  }

  /*
  العميل يستطيع التواصل مع المدرب فقط
  */

  if (currentUser.role === "client") {
    return otherUser.role === "admin";
  }

  return false;
};

/*
=========================================================
CHAT UPLOAD DIRECTORY
=========================================================

مهم جدًا:

Netlify Functions تعمل داخل بيئة لا تسمح بالكتابة
داخل /var/task.

لذلك نستخدم /tmp للملفات المؤقتة.

في التطوير المحلي سيعمل أيضًا بدون مشاكل.
=========================================================
*/

const chatUploadDir = path.join(
  "/tmp",
  "gym-coach",
  "uploads",
  "chat"
);

/*
=========================================================
MULTER STORAGE
=========================================================
*/

const storage = multer.diskStorage({
  destination: (
    _req,
    _file,
    cb
  ) => {
    /*
    لا نقوم بإنشاء المجلد هنا يدويًا.

    سيتم إنشاؤه عند الحاجة فقط داخل /tmp.
    */

    const fs = require("fs");

    try {
      fs.mkdirSync(
        chatUploadDir,
        {
          recursive: true,
        }
      );

      cb(
        null,
        chatUploadDir
      );
    } catch (error) {
      cb(error);
    }
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

    const safeName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(
          2,
          10
        )}${extension}`;

    cb(
      null,
      safeName
    );
  },
});

/*
=========================================================
IMAGE UPLOAD
=========================================================
*/

const imageUpload = multer({
  storage,

  limits: {
    fileSize:
      5 * 1024 * 1024,
  },

  fileFilter: (
    _req,
    file,
    cb
  ) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowed.includes(
        file.mimetype
      )
    ) {
      return cb(
        new Error(
          "يسمح فقط بصور JPG أو PNG أو WEBP"
        )
      );
    }

    cb(
      null,
      true
    );
  },
});

const IMAGE_PREFIX =
  "__CHAT_IMAGE__:";

/*
=========================================================
NORMALIZE MESSAGE
=========================================================
*/

const normalizeMessage = (
  item
) => {
  if (!item) {
    return item;
  }

  if (
    typeof item.message ===
      "string" &&
    item.message.startsWith(
      IMAGE_PREFIX
    )
  ) {
    return {
      ...item,

      message: "",

      message_type:
        "image",

      image_url:
        null,

      media_url:
        `/api/media/chat/${item.id}`,
    };
  }

  return {
    ...item,

    message_type:
      "text",

    image_url:
      null,

    media_url:
      null,
  };
};

/*
=========================================================
GET MESSAGE BY ID
=========================================================
*/

const getMessageById =
  async (id) => {
    const [rows] =
      await db.query(
        `
        SELECT
          m.id,
          m.sender_id,
          m.receiver_id,
          m.message,
          m.is_read,
          m.created_at,

          s.name AS sender_name,
          r.name AS receiver_name

        FROM messages m

        INNER JOIN users s
          ON s.id = m.sender_id

        INNER JOIN users r
          ON r.id = m.receiver_id

        WHERE m.id = ?

        LIMIT 1
        `,
        [id]
      );

    return normalizeMessage(
      rows[0]
    );
  };

/*
=========================================================
SEND TEXT MESSAGE
=========================================================
*/

router.post(
  "/",
  verifyToken,
  async (
    req,
    res
  ) => {
    try {
      const senderId =
        Number(
          req.user.id
        );

      const {
        receiver_id,
        message,
      } = req.body;

      const receiverId =
        Number(
          receiver_id
        );

      /*
      -----------------------------------------------------
      Validate message
      -----------------------------------------------------
      */

      if (
        !Number.isInteger(
          receiverId
        ) ||
        receiverId <= 0 ||
        !message ||
        !String(
          message
        ).trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "المستلم والرسالة مطلوبان",
          });
      }

      /*
      -----------------------------------------------------
      Prevent self chat
      -----------------------------------------------------
      */

      if (
        receiverId ===
        senderId
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "لا يمكنك إرسال رسالة إلى نفسك",
          });
      }

      /*
      -----------------------------------------------------
      Get receiver
      -----------------------------------------------------
      */

      const receiver =
        await getChatUser(
          receiverId
        );

      if (!receiver) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "المستخدم المستلم غير موجود",
          });
      }

      /*
      -----------------------------------------------------
      Check chat permission
      -----------------------------------------------------
      */

      if (
        !canChatWith(
          req.user,
          receiver
        )
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "ليس لديك صلاحية للتواصل مع هذا المستخدم",
          });
      }

      /*
      -----------------------------------------------------
      Insert message
      -----------------------------------------------------
      */

      const [
        result,
      ] = await db.query(
        `
        INSERT INTO messages
        (
          sender_id,
          receiver_id,
          message
        )

        VALUES (?, ?, ?)
        `,
        [
          senderId,
          receiverId,
          String(
            message
          ).trim(),
        ]
      );

      /*
      -----------------------------------------------------
      Notification
      -----------------------------------------------------
      */

      await createNotification({
        userId:
          receiverId,

        type:
          "message",

        title:
          "رسالة جديدة",

        message:
          `لديك رسالة جديدة من ${
            req.user.name ||
            "مستخدم"
          }`,

        link:
          receiver.role ===
          "admin"
            ? `/admin-chat?clientId=${senderId}`
            : `/client/chat`,
      });

      /*
      -----------------------------------------------------
      Response
      -----------------------------------------------------
      */

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "تم إرسال الرسالة بنجاح",

          data:
            await getMessageById(
              result.insertId
            ),
        });
    } catch (error) {
      console.error(
        "Send message error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "حدث خطأ أثناء إرسال الرسالة",
        });
    }
  }
);

/*
=========================================================
SEND IMAGE MESSAGE
=========================================================
*/

router.post(
  "/image",
  verifyToken,
  chatImageLimiter,
  (
    req,
    res
  ) => {
    imageUpload.single(
      "image"
    )(
      req,
      res,
      async (
        uploadError
      ) => {
        if (uploadError) {
          console.error(
            "Chat image upload error:",
            uploadError
          );

          const message =
            uploadError.code ===
            "LIMIT_FILE_SIZE"
              ? "حجم الصورة يجب ألا يتجاوز 5MB"
              : uploadError.message ||
                "تعذر رفع الصورة";

          return res
            .status(400)
            .json({
              success:
                false,

              message,
            });
        }

        try {
          /*
          -------------------------------------------------
          Validate uploaded file
          -------------------------------------------------
          */

          if (!req.file) {
            return res
              .status(400)
              .json({
                success:
                  false,

                message:
                  "اختر صورة أولًا",
              });
          }

          const senderId =
            Number(
              req.user.id
            );

          const receiverId =
            Number(
              req.body
                .receiver_id
            );

          /*
          -------------------------------------------------
          Validate receiver
          -------------------------------------------------
          */

          if (
            !Number.isInteger(
              receiverId
            ) ||
            receiverId <= 0
          ) {
            removeLocalFile(
              req.file?.path
            );

            return res
              .status(400)
              .json({
                success:
                  false,

                message:
                  "معرف المستلم غير صحيح",
              });
          }

          /*
          -------------------------------------------------
          Prevent self image
          -------------------------------------------------
          */

          if (
            receiverId ===
            senderId
          ) {
            removeLocalFile(
              req.file?.path
            );

            return res
              .status(403)
              .json({
                success:
                  false,

                message:
                  "لا يمكنك إرسال صورة إلى نفسك",
              });
          }

          /*
          -------------------------------------------------
          Get receiver
          -------------------------------------------------
          */

          const receiver =
            await getChatUser(
              receiverId
            );

          if (!receiver) {
            removeLocalFile(
              req.file?.path
            );

            return res
              .status(404)
              .json({
                success:
                  false,

                message:
                  "المستخدم المستلم غير موجود",
              });
          }

          /*
          -------------------------------------------------
          Check chat permission
          -------------------------------------------------
          */

          if (
            !canChatWith(
              req.user,
              receiver
            )
          ) {
            removeLocalFile(
              req.file?.path
            );

            return res
              .status(403)
              .json({
                success:
                  false,

                message:
                  "ليس لديك صلاحية لإرسال صورة إلى هذا المستخدم",
              });
          }

          /*
          -------------------------------------------------
          Store image
          -------------------------------------------------

          Cloudinary:
          authenticated

          Local:
          /tmp only

          -------------------------------------------------
          */

          const stored =
            await storeUploadedFile(
              req.file,
              {
                resourceType:
                  "image",

                folder:
                  "gym-coach/chat",

                deliveryType:
                  "authenticated",

                localUrl:
                  `/uploads/chat/${req.file.filename}`,
              }
            );

          const imageUrl =
            stored.url;

          /*
          -------------------------------------------------
          Insert image message
          -------------------------------------------------
          */

          const [
            result,
          ] = await db.query(
            `
            INSERT INTO messages
            (
              sender_id,
              receiver_id,
              message
            )

            VALUES (?, ?, ?)
            `,
            [
              senderId,
              receiverId,
              `${IMAGE_PREFIX}${imageUrl}`,
            ]
          );

          /*
          -------------------------------------------------
          Notification
          -------------------------------------------------
          */

          await createNotification({
            userId:
              receiverId,

            type:
              "message",

            title:
              "صورة جديدة",

            message:
              `أرسل لك ${
                req.user.name ||
                "مستخدم"
              } صورة جديدة`,

            link:
              receiver.role ===
              "admin"
                ? `/admin-chat?clientId=${senderId}`
                : `/client/chat`,
          });

          /*
          -------------------------------------------------
          Response
          -------------------------------------------------
          */

          return res
            .status(201)
            .json({
              success:
                true,

              message:
                "تم إرسال الصورة بنجاح",

              data:
                await getMessageById(
                  result.insertId
                ),
            });
        } catch (error) {
          removeLocalFile(
            req.file?.path
          );

          console.error(
            "Save chat image error:",
            error
          );

          return res
            .status(500)
            .json({
              success:
                false,

              message:
                "حدث خطأ أثناء حفظ الصورة",
            });
        }
      }
    );
  }
);

/*
=========================================================
GET COACH
=========================================================
*/

router.get(
  "/coach",
  verifyToken,
  async (
    req,
    res
  ) => {
    try {
      if (
        req.user.role !==
        "client"
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "هذه العملية خاصة بالعملاء",
          });
      }

      const [
        coaches,
      ] = await db.query(
        `
        SELECT
          id,
          name,
          email,
          role

        FROM users

        WHERE role = 'admin'

        ORDER BY id ASC

        LIMIT 1
        `
      );

      if (!coaches.length) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "لا يوجد مدرب متاح",
          });
      }

      return res.json({
        success:
          true,

        coach:
          coaches[0],
      });
    } catch (error) {
      console.error(
        "Get coach error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "حدث خطأ أثناء جلب بيانات المدرب",
        });
    }
  }
);

/*
=========================================================
TOTAL UNREAD
=========================================================
*/

router.get(
  "/unread/count",
  verifyToken,
  async (
    req,
    res
  ) => {
    try {
      const [
        result,
      ] = await db.query(
        `
        SELECT
          COUNT(*) AS unread_count

        FROM messages

        WHERE receiver_id = ?

          AND is_read = 0
        `,
        [req.user.id]
      );

      return res.json({
        success:
          true,

        unread_count:
          Number(
            result[0]
              ?.unread_count ||
              0
          ),
      });
    } catch (error) {
      console.error(
        "Unread messages error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "حدث خطأ أثناء حساب الرسائل غير المقروءة",
        });
    }
  }
);

/*
=========================================================
UNREAD BY CLIENT
=========================================================
مهم:
هذا المسار يجب أن يكون قبل /:userId
=========================================================
*/

router.get(
  "/unread/by-client",
  verifyToken,
  async (
    req,
    res
  ) => {
    try {
      if (
        req.user.role !==
        "admin"
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "هذه العملية خاصة بالمدرب",
          });
      }

      const [
        rows,
      ] = await db.query(
        `
        SELECT
          sender_id AS client_id,
          COUNT(*) AS unread_count

        FROM messages

        WHERE receiver_id = ?

          AND is_read = 0

          AND sender_id IN (
            SELECT id
            FROM users
            WHERE role = 'client'
          )

        GROUP BY sender_id
        `,
        [req.user.id]
      );

      const counts =
        {};

      rows.forEach(
        (row) => {
          counts[
            String(
              row.client_id
            )
          ] =
            Number(
              row.unread_count ||
                0
            );
        }
      );

      return res.json({
        success:
          true,

        counts,
      });
    } catch (error) {
      console.error(
        "Unread messages by client error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "تعذر تحميل الرسائل غير المقروءة",
        });
    }
  }
);

/*
=========================================================
GET CONVERSATION
=========================================================
فتح المحادثة يجعل رسائل الطرف الآخر مقروءة.
=========================================================
*/

router.get(
  "/:userId",
  verifyToken,
  async (
    req,
    res
  ) => {
    try {
      const currentUserId =
        Number(
          req.user.id
        );

      const otherUserId =
        Number(
          req.params.userId
        );

      /*
      -----------------------------------------------------
      Validate user id
      -----------------------------------------------------
      */

      if (
        !Number.isInteger(
          otherUserId
        ) ||
        otherUserId <= 0
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "معرف المستخدم غير صحيح",
          });
      }

      /*
      -----------------------------------------------------
      Prevent self conversation
      -----------------------------------------------------
      */

      if (
        otherUserId ===
        currentUserId
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "لا يمكنك فتح محادثة مع نفسك",
          });
      }

      /*
      -----------------------------------------------------
      Get other user
      -----------------------------------------------------
      */

      const otherUser =
        await getChatUser(
          otherUserId
        );

      if (!otherUser) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "المستخدم غير موجود",
          });
      }

      /*
      -----------------------------------------------------
      Check permission
      -----------------------------------------------------
      */

      if (
        !canChatWith(
          req.user,
          otherUser
        )
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "ليس لديك صلاحية لعرض هذه المحادثة",
          });
      }

      /*
      -----------------------------------------------------
      Get conversation
      -----------------------------------------------------
      */

      const [
        rows,
      ] = await db.query(
        `
        SELECT
          m.id,
          m.sender_id,
          m.receiver_id,
          m.message,
          m.is_read,
          m.created_at,

          s.name AS sender_name,
          r.name AS receiver_name

        FROM messages m

        INNER JOIN users s
          ON s.id = m.sender_id

        INNER JOIN users r
          ON r.id = m.receiver_id

        WHERE
          (
            m.sender_id = ?
            AND
            m.receiver_id = ?
          )

          OR

          (
            m.sender_id = ?
            AND
            m.receiver_id = ?
          )

        ORDER BY
          m.created_at ASC
        `,
        [
          currentUserId,
          otherUserId,
          otherUserId,
          currentUserId,
        ]
      );

      /*
      -----------------------------------------------------
      Mark messages from the other user as read
      -----------------------------------------------------
      */

      await db.query(
        `
        UPDATE messages

        SET is_read = 1

        WHERE sender_id = ?

          AND receiver_id = ?

          AND is_read = 0
        `,
        [
          otherUserId,
          currentUserId,
        ]
      );

      /*
      -----------------------------------------------------
      Response
      -----------------------------------------------------
      */

      return res.json({
        success:
          true,

        messages:
          rows.map(
            normalizeMessage
          ),
      });
    } catch (error) {
      console.error(
        "Get messages error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "حدث خطأ أثناء جلب الرسائل",
        });
    }
  }
);

module.exports = router;
