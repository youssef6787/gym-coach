const fs = require("fs");
const path = require("path");

require("dotenv").config();

const db = require("../config/db");

const {
  uploadToCloudinary,
} = require("../config/storage");

const EXERCISE_ID = 1;

const LOCAL_VIDEO = path.resolve(
  __dirname,
  "../uploads/exercises/exercise-1786959830432-211637.mp4"
);

async function main() {
console.log("ðŸ” Exercise video migration");
try {
    // ----------------------------------------
    // 1. Ø§Ù„ØªØ£ÙƒØ¯ Ù…Ù† ÙˆØ¬ÙˆØ¯ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ
    // ----------------------------------------
console.log("ðŸ“ Checking local video...");

    if (!fs.existsSync(LOCAL_VIDEO)) {
      throw new Error(
        `Local video not found:\n${LOCAL_VIDEO}`
      );
    }
console.log(LOCAL_VIDEO);

    // ----------------------------------------
    // 2. Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„ØªÙ…Ø±ÙŠÙ† Ù…Ù† Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª
    // ----------------------------------------
console.log("ðŸ—„ï¸ Checking exercise...");

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

    if (rows.length === 0) {
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
    // 3. Ù…Ù†Ø¹ Ø§Ù„ØªØ±Ø­ÙŠÙ„ Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ù…Ø¤Ù…Ù‘Ù†Ù‹Ø§
    // ----------------------------------------

    if (
      exercise.video_url &&
      exercise.video_url.includes(
        "/video/authenticated/"
      )
    ) {
console.log(
        "â„¹ï¸ This exercise is already using authenticated Cloudinary storage."
      );

      process.exit(0);
    }

    // ----------------------------------------
    // 4. Ø±ÙØ¹ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ø¥Ù„Ù‰ Cloudinary
    // ----------------------------------------
console.log(
      "â˜ï¸ Uploading video to Cloudinary..."
    );

    const uploaded =
      await uploadToCloudinary(
        LOCAL_VIDEO,
        {
          resourceType: "video",
          folder: "gym-coach/exercises",
          deliveryType: "authenticated",
        }
      );

    if (!uploaded) {
      throw new Error(
        "Cloudinary upload returned no result."
      );
    }

    if (!uploaded.url) {
      throw new Error(
        "Cloudinary did not return a secure URL."
      );
    }
console.log("âœ“ Cloudinary upload successful");

    console.log(
      `Public ID: ${uploaded.publicId}`
    );

    console.log(
      `Resource type: ${uploaded.resourceType}`
    );

    console.log(
      `Delivery type: ${uploaded.deliveryType}`
    );

    console.log(
      `URL: ${uploaded.url}`
    );

    // ----------------------------------------
    // 5. Ø§Ù„ØªØ£ÙƒØ¯ Ø£Ù† Ø§Ù„Ù…Ù„Ù Ø£ØµØ¨Ø­ authenticated
    // ----------------------------------------

    if (
      !uploaded.url.includes(
        "/video/authenticated/"
      )
    ) {
      throw new Error(
        "Uploaded video is not authenticated."
      );
    }

    // ----------------------------------------
    // 6. ØªØ­Ø¯ÙŠØ« Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª
    // ----------------------------------------
console.log(
      "ðŸ—„ï¸ Updating exercises.video_url..."
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
      "âœ“ Database updated successfully"
    );

    // ----------------------------------------
    // 7. Ø§Ù„ØªØ­Ù‚Ù‚ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ
    // ----------------------------------------

    const [updatedRows] =
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
console.log(
      "========================================"
    );
console.log(
      "========================================"
    );

    console.log(
      `Exercise ID: ${updatedRows[0].id}`
    );

    console.log(
      `Exercise: ${updatedRows[0].name}`
    );

    console.log(
      `New video URL: ${updatedRows[0].video_url}`
    );
console.log(
      "ðŸ” Video is now stored as authenticated."
    );
} catch (error) {
    console.error("");
    console.error(
      "âŒ Migration failed:"
    );
    console.error(
      error.message
    );

    if (error.stack) {
      console.error("");
      console.error(
        error.stack
      );
    }

    process.exitCode = 1;
  }
}

main();
