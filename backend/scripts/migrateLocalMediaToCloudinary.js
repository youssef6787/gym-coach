const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const {
  cloudinaryEnabled,
  uploadToCloudinary,
  removeLocalFile,
} = require("../config/storage");

const ROOT = path.join(__dirname, "..");

const migrateRows = async ({ table, column, folder, resourceType, prefix, deliveryType }) => {
  const [rows] = await db.query(
    `SELECT id, ${column} AS media_url FROM ${table} WHERE ${column} LIKE ?`,
    [`${prefix}%`]
  );

  let migrated = 0;
  let missing = 0;

  for (const row of rows) {
    const relativePath = String(row.media_url || "").replace(/^\/uploads\//, "uploads/");
    const filePath = path.join(ROOT, relativePath);

    if (!fs.existsSync(filePath)) {
      missing += 1;
      console.warn(`⚠️ Missing local media: ${relativePath}`);
      continue;
    }

    try {
      const uploaded = await uploadToCloudinary(filePath, {
        resourceType,
        folder,
        deliveryType,
      });

      await db.query(
        `UPDATE ${table} SET ${column} = ? WHERE id = ?`,
        [uploaded.url, row.id]
      );

      removeLocalFile(filePath);
      migrated += 1;
      console.log(`✅ Migrated ${table} #${row.id}`);
    } catch (error) {
      console.error(`❌ Failed ${table} #${row.id}: ${error.message}`);
    }
  }

  return { migrated, missing };
};

const migrateChatImages = async () => {
  const prefix = "__CHAT_IMAGE__:";
  const [messages] = await db.query(
    `SELECT id, message FROM messages WHERE message LIKE '__CHAT_IMAGE__:/uploads/chat/%'`
  );

  let migrated = 0;
  let missing = 0;

  for (const row of messages) {
    const url = row.message.replace(prefix, "");
    const filePath = path.join(ROOT, url.replace(/^\/uploads\//, "uploads/"));

    if (!fs.existsSync(filePath)) {
      missing += 1;
      console.warn(`⚠️ Missing chat image: ${url}`);
      continue;
    }

    try {
      const uploaded = await uploadToCloudinary(filePath, {
        resourceType: "image",
        folder: "gym-coach/chat",
        deliveryType: "authenticated",
      });

      await db.query(
        "UPDATE messages SET message = ? WHERE id = ?",
        [`${prefix}${uploaded.url}`, row.id]
      );

      removeLocalFile(filePath);
      migrated += 1;
      console.log(`✅ Migrated chat image #${row.id}`);
    } catch (error) {
      console.error(`❌ Failed chat image #${row.id}: ${error.message}`);
    }
  }

  return { migrated, missing };
};

(async () => {
  if (!cloudinaryEnabled) {
    throw new Error("Configure Cloudinary credentials first.");
  }

  console.log("Starting local media migration to Cloudinary...");

  const transformations = await migrateRows({
    table: "transformations",
    column: "image_url",
    folder: "gym-coach/transformations",
    resourceType: "image",
    prefix: "/uploads/transformations/",
    deliveryType: "upload",
  });

  const exercises = await migrateRows({
    table: "exercises",
    column: "video_url",
    folder: "gym-coach/exercises",
    resourceType: "video",
    prefix: "/uploads/exercises/",
    deliveryType: "authenticated",
  });

  const chat = await migrateChatImages();

  console.log("\nMigration summary");
  console.log({ transformations, exercises, chat });
})()
  .catch((error) => {
    console.error("❌ Media migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await db.end(); } catch {}
  });
