const fs = require('fs');
const path = require('path');

require('dotenv').config();

const db = require('../config/db');

const {
  cloudinaryEnabled,
  uploadToCloudinary,
} = require('../config/storage');

const EXERCISE_ID = 31;

const LOCAL_VIDEO =
  'C:\\Users\\eljoker\\Videos\\Screen Recordings\\Screen Recording 2026-08-16 173955.mp4';

async function main() {
console.log('ðŸ” Exercise 31 migration');
try {
    // ----------------------------------------
    // 1. Check Cloudinary
    // ----------------------------------------

    if (!cloudinaryEnabled) {
      throw new Error(
        'Cloudinary is not configured correctly.'
      );
    }
// ----------------------------------------
    // 2. Check local file
    // ----------------------------------------
console.log('ðŸ“ Checking local video...');

    if (!fs.existsSync(LOCAL_VIDEO)) {
      throw new Error(
        `Local video not found:\n${LOCAL_VIDEO}`
      );
    }
console.log(LOCAL_VIDEO);

    // ----------------------------------------
    // 3. Read exercise
    // ----------------------------------------
console.log('ðŸ—„ï¸ Checking exercise 31...');

    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        video_url
      FROM exercises
      WHERE id = ?
      LIMIT 1
      `,
      [EXERCISE_ID]
    );

    if (!rows.length) {
      throw new Error(
        `Exercise ${EXERCISE_ID} was not found.`
      );
    }

    const exercise = rows[0];

    console.log(
      `âœ“ Exercise found: ${exercise.name}`
    );

    console.log(
      `Current video_url: ${exercise.video_url}`
    );

    // ----------------------------------------
    // 4. Safety check
    // ----------------------------------------

    if (
      typeof exercise.video_url === 'string' &&
      exercise.video_url.includes(
        '/video/authenticated/'
      )
    ) {
console.log(
        'â„¹ï¸ Exercise 31 is already authenticated.'
      );

      return;
    }

    // ----------------------------------------
    // 5. Upload to Cloudinary
    // ----------------------------------------
console.log(
      'â˜ï¸ Uploading exercise 31 to Cloudinary...'
    );

    const uploaded =
      await uploadToCloudinary(
        LOCAL_VIDEO,
        {
          resourceType: 'video',
          folder: 'gym-coach/exercises',
          deliveryType: 'authenticated',
        }
      );

    if (!uploaded || !uploaded.url) {
      throw new Error(
        'Cloudinary upload failed: no URL returned.'
      );
    }
console.log(
      'âœ“ Cloudinary upload successful'
    );

    console.log(
      `Public ID: ${uploaded.publicId}`
    );

    console.log(
      `Delivery type: ${uploaded.deliveryType}`
    );

    console.log(
      `URL: ${uploaded.url}`
    );

    // ----------------------------------------
    // 6. Verify authenticated delivery
    // ----------------------------------------

    if (
      !uploaded.url.includes(
        '/video/authenticated/'
      )
    ) {
      throw new Error(
        'Safety check failed: uploaded video is not authenticated.'
      );
    }

    console.log(
      'âœ“ Authenticated delivery confirmed'
    );

    // ----------------------------------------
    // 7. Update database
    // ----------------------------------------
console.log(
      'ðŸ—„ï¸ Updating database...'
    );

    await db.query(
      `
      UPDATE exercises
      SET video_url = ?
      WHERE id = ?
      `,
      [
        uploaded.url,
        EXERCISE_ID,
      ]
    );

    console.log(
      'âœ“ Database updated successfully'
    );

    // ----------------------------------------
    // 8. Verify database
    // ----------------------------------------

    const [verifyRows] =
      await db.query(
        `
        SELECT
          id,
          name,
          video_url
        FROM exercises
        WHERE id = ?
        LIMIT 1
        `,
        [EXERCISE_ID]
      );

    if (!verifyRows.length) {
      throw new Error(
        'Could not verify database update.'
      );
    }

    const updated =
      verifyRows[0];

    if (
      !updated.video_url.includes(
        '/video/authenticated/'
      )
    ) {
      throw new Error(
        'Database verification failed.'
      );
    }
console.log(
      '========================================'
    );
    console.log(
      'ðŸŽ‰ Exercise 31 migration completed'
    );
    console.log(
      '========================================'
    );

    console.log(
      `ID: ${updated.id}`
    );

    console.log(
      `Name: ${updated.name}`
    );

    console.log(
      `New URL: ${updated.video_url}`
    );
console.log(
      'ðŸ” Exercise 31 is now stored privately.'
    );

    // ----------------------------------------
    // IMPORTANT:
    // Do NOT delete the local file automatically.
    // Keep it as a backup until we verify playback.
    // ----------------------------------------
console.log(
      'â„¹ï¸ Local source file was NOT deleted.'
    );

    console.log(
      'Keep it as a backup until playback is verified.'
    );

  } catch (error) {
    console.error('');
    console.error(
      'âŒ Exercise 31 migration failed:'
    );

    console.error(
      error.message
    );

    if (error.stack) {
      console.error('');
      console.error(
        error.stack
      );
    }

    process.exitCode = 1;
  } finally {
    // Close DB connection if supported.
    if (
      db &&
      typeof db.end === 'function'
    ) {
      await db.end().catch(() => {});
    }
  }
}

main();
