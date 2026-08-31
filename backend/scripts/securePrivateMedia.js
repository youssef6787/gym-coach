const db = require('../config/db');
const {
  cloudinaryEnabled,
  renameToAuthenticated,
  deliveryTypeFromUrl,
} = require('../config/storage');

async function secureExerciseVideos() {
  const [rows] = await db.query(
    `SELECT id, video_url FROM exercises WHERE video_url IS NOT NULL AND video_url <> ''`
  );

  let changed = 0;
  for (const row of rows) {
    if (!row.video_url || !row.video_url.includes('res.cloudinary.com')) continue;
    if (deliveryTypeFromUrl(row.video_url) === 'authenticated') continue;

    try {
      const secureUrl = await renameToAuthenticated(row.video_url);
      await db.query('UPDATE exercises SET video_url = ? WHERE id = ?', [secureUrl, row.id]);
      changed += 1;
} catch (error) {
      console.error(`âœ— exercise ${row.id}:`, error.message);
    }
  }

  return changed;
}

async function secureChatImages() {
  const prefix = '__CHAT_IMAGE__:';
  const [rows] = await db.query(
    `SELECT id, message FROM messages WHERE message LIKE ?`,
    [`${prefix}%`]
  );

  let changed = 0;
  for (const row of rows) {
    const url = row.message.slice(prefix.length);
    if (!url.includes('res.cloudinary.com')) continue;
    if (deliveryTypeFromUrl(url) === 'authenticated') continue;

    try {
      const secureUrl = await renameToAuthenticated(url);
      await db.query('UPDATE messages SET message = ? WHERE id = ?', [
        `${prefix}${secureUrl}`,
        row.id,
      ]);
      changed += 1;
} catch (error) {
      console.error(`âœ— chat image ${row.id}:`, error.message);
    }
  }

  return changed;
}

async function main() {
  if (!cloudinaryEnabled) {
    throw new Error('Cloudinary is not configured. Check backend/.env first.');
  }
const exerciseCount = await secureExerciseVideos();
  const chatCount = await secureChatImages();
}

main()
  .catch((error) => {
    console.error('Private media migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await db.end(); } catch {}
  });

