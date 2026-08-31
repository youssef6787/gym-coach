const mysql = require("mysql2/promise");
const env = require("./env");

/*
=========================================================
LOCAL MYSQL DATABASE
=========================================================

الوضع الحالي للمشروع:
- قاعدة البيانات تعمل على MySQL المحلي.
- Cloudinary مسؤول فقط عن تخزين الصور والفيديوهات.
- لا نستخدم Aiven SSL هنا.
- لا نحتاج إلى AIVEN_CA_CERT_BASE64 أو aiven-ca.pem.
=========================================================
*/

const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: Number(env.DB_PORT),

  charset: "utf8mb4",

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  idleTimeout: 60000,
  maxIdle: 10,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

/*
=========================================================
DATABASE HEALTH CHECK
=========================================================
*/

const checkDatabaseConnection = async () => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.query("SELECT 1");

    console.log("✅ Local MySQL connection successful");
    console.log(
      `📦 Database: ${env.DB_NAME} | Host: ${env.DB_HOST}:${env.DB_PORT}`
    );

    return true;
  } catch (error) {
    console.error(
      "❌ Local MySQL connection check failed:",
      error.message
    );

    return false;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/*
=========================================================
EXPORT
=========================================================
*/

module.exports = pool;

module.exports.checkDatabaseConnection =
  checkDatabaseConnection;
