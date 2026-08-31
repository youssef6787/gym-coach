const express = require("express");
const path = require("path");

const db = require("../config/db");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  cloudinaryEnabled,
  getProtectedMediaUrl,
} = require("../config/storage");

const router =
  express.Router();

/*
==========================================================
COMMON RESPONSES
==========================================================
*/

const forbidden = (
  res
) =>
  res.status(403).json({
    success: false,
    message:
      "ليس لديك صلاحية للوصول إلى هذا الملف",
  });

/*
==========================================================
HELPERS
==========================================================
*/

const isPositiveInteger = (
  value
) => {
  return (
    Number.isInteger(
      value
    ) &&
    value > 0
  );
};

const CHAT_IMAGE_PREFIX =
  "__CHAT_IMAGE__:";

/*
==========================================================
PROTECTED EXERCISE VIDEO
==========================================================
*/

router.get(
  "/exercise/:exerciseId",
  verifyToken,
  async (req, res) => {
    try {
      const exerciseId =
        Number(
          req.params.exerciseId
        );

      if (
        !isPositiveInteger(
          exerciseId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم التمرين غير صحيح",
        });
      }

      const [rows] =
        await db.query(
          `
          SELECT
            e.id,
            e.video_url,
            tp.client_id
          FROM exercises e
          INNER JOIN training_days td
            ON td.id = e.day_id
          INNER JOIN training_programs tp
            ON tp.id = td.program_id
          WHERE e.id = ?
          LIMIT 1
          `,
          [exerciseId]
        );

      if (
        !rows.length ||
        !rows[0].video_url
      ) {
        return res.status(404).json({
          success: false,
          message:
            "فيديو التمرين غير موجود",
        });
      }

      const exercise =
        rows[0];

      /*
      ----------------------------------------
      Authorization
      ----------------------------------------
      */

      const isAdmin =
        req.user.role ===
        "admin";

      const isOwner =
        req.user.role ===
          "client" &&
        Number(
          exercise.client_id
        ) ===
          Number(
            req.user.id
          );

      if (
        !isAdmin &&
        !isOwner
      ) {
        return forbidden(res);
      }

      const mediaUrl =
        String(
          exercise.video_url
        ).trim();

      /*
      ----------------------------------------
      Local legacy video
      ----------------------------------------
      */

      if (
        !cloudinaryEnabled &&
        mediaUrl.startsWith(
          "/uploads/exercises/"
        )
      ) {
        return res.json({
          success: true,

          url:
            `${req.protocol}://${req.get(
              "host"
            )}` +
            `/api/media/local/exercise/${exerciseId}`,
        });
      }

      /*
      ----------------------------------------
      Protected Cloudinary video
      ----------------------------------------
      
      يتم إعادة توليد الرابط المحمي
      بدل إعادة إرسال الرابط القديم.
      */

      const protectedUrl =
        getProtectedMediaUrl(
          mediaUrl
        );

      if (!protectedUrl) {
        return res.status(409).json({
          success: false,
          message:
            "هذا الفيديو قديم ولم تتم ترقيته إلى التخزين الخاص بعد",
        });
      }

      return res.json({
        success: true,
        url:
          protectedUrl,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message:
          "تعذر تجهيز فيديو التمرين",
      });
    }
  }
);

/*
==========================================================
PROTECTED CHAT IMAGE
==========================================================
*/

router.get(
  "/chat/:messageId",
  verifyToken,
  async (req, res) => {
    try {
      const messageId =
        Number(
          req.params.messageId
        );

      if (
        !isPositiveInteger(
          messageId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "رقم الرسالة غير صحيح",
        });
      }

      const [rows] =
        await db.query(
          `
          SELECT
            id,
            sender_id,
            receiver_id,
            message
          FROM messages
          WHERE id = ?
          LIMIT 1
          `,
          [messageId]
        );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          message:
            "الرسالة غير موجودة",
        });
      }

      const item =
        rows[0];

      /*
      ----------------------------------------
      Authorization
      ----------------------------------------
      */

      const isAdmin =
        req.user.role ===
        "admin";

      const isParticipant =
        Number(
          item.sender_id
        ) ===
          Number(
            req.user.id
          ) ||
        Number(
          item.receiver_id
        ) ===
          Number(
            req.user.id
          );

      if (
        !isAdmin &&
        !isParticipant
      ) {
        return forbidden(res);
      }

      /*
      ----------------------------------------
      Extract image URL
      ----------------------------------------
      */

      if (
        typeof item.message !==
          "string" ||
        !item.message.startsWith(
          CHAT_IMAGE_PREFIX
        )
      ) {
        return res.status(404).json({
          success: false,
          message:
            "لا توجد صورة في هذه الرسالة",
        });
      }

      const mediaUrl =
        item.message
          .slice(
            CHAT_IMAGE_PREFIX.length
          )
          .trim();

      /*
      ----------------------------------------
      Local legacy image
      ----------------------------------------
      */

      if (
        !cloudinaryEnabled &&
        mediaUrl.startsWith(
          "/uploads/chat/"
        )
      ) {
        return res.json({
          success: true,

          url:
            `${req.protocol}://${req.get(
              "host"
            )}` +
            `/api/media/local/chat/${messageId}`,
        });
      }

      /*
      ----------------------------------------
      Protected Cloudinary image
      ----------------------------------------
      */

      const protectedUrl =
        getProtectedMediaUrl(
          mediaUrl
        );

      if (!protectedUrl) {
        return res.status(409).json({
          success: false,
          message:
            "هذه الصورة قديمة ولم تتم ترقيتها إلى التخزين الخاص بعد",
        });
      }

      return res.json({
        success: true,
        url:
          protectedUrl,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message:
          "تعذر تجهيز صورة المحادثة",
      });
    }
  }
);

/*
==========================================================
LOCAL EXERCISE VIDEO
==========================================================
*/

router.get(
  "/local/exercise/:exerciseId",
  verifyToken,
  async (req, res) => {
    try {
      const exerciseId =
        Number(
          req.params.exerciseId
        );

      if (
        !isPositiveInteger(
          exerciseId
        )
      ) {
        return res.status(400).end();
      }

      const [rows] =
        await db.query(
          `
          SELECT
            e.video_url,
            tp.client_id
          FROM exercises e
          INNER JOIN training_days td
            ON td.id = e.day_id
          INNER JOIN training_programs tp
            ON tp.id = td.program_id
          WHERE e.id = ?
          LIMIT 1
          `,
          [exerciseId]
        );

      if (
        !rows.length ||
        !rows[0].video_url
      ) {
        return res.status(404).end();
      }

      const allowed =
        req.user.role ===
          "admin" ||
        Number(
          rows[0].client_id
        ) ===
          Number(
            req.user.id
          );

      if (!allowed) {
        return forbidden(res);
      }

      const mediaUrl =
        String(
          rows[0].video_url
        ).trim();

      if (
        !mediaUrl.startsWith(
          "/uploads/exercises/"
        )
      ) {
        return res.status(404).end();
      }

      const filename =
        path.basename(
          mediaUrl
        );

      return res.sendFile(
        path.join(
          __dirname,
          "..",
          "uploads",
          "exercises",
          filename
        )
      );
    } catch {
      return res.status(500).end();
    }
  }
);

/*
==========================================================
LOCAL CHAT IMAGE
==========================================================
*/

router.get(
  "/local/chat/:messageId",
  verifyToken,
  async (req, res) => {
    try {
      const messageId =
        Number(
          req.params.messageId
        );

      if (
        !isPositiveInteger(
          messageId
        )
      ) {
        return res.status(400).end();
      }

      const [rows] =
        await db.query(
          `
          SELECT
            sender_id,
            receiver_id,
            message
          FROM messages
          WHERE id = ?
          LIMIT 1
          `,
          [messageId]
        );

      if (!rows.length) {
        return res.status(404).end();
      }

      const item =
        rows[0];

      const allowed =
        req.user.role ===
          "admin" ||
        Number(
          item.sender_id
        ) ===
          Number(
            req.user.id
          ) ||
        Number(
          item.receiver_id
        ) ===
          Number(
            req.user.id
          );

      if (!allowed) {
        return forbidden(res);
      }

      if (
        typeof item.message !==
          "string" ||
        !item.message.startsWith(
          CHAT_IMAGE_PREFIX
        )
      ) {
        return res.status(404).end();
      }

      const mediaUrl =
        item.message
          .slice(
            CHAT_IMAGE_PREFIX.length
          )
          .trim();

      if (
        !mediaUrl.startsWith(
          "/uploads/chat/"
        )
      ) {
        return res.status(404).end();
      }

      const filename =
        path.basename(
          mediaUrl
        );

      return res.sendFile(
        path.join(
          __dirname,
          "..",
          "uploads",
          "chat",
          filename
        )
      );
    } catch {
      return res.status(500).end();
    }
  }
);

module.exports = router;