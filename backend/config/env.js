const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.join(__dirname, "..", ".env"),
});

const getEnvValue = (key, fallback = "") => {
  const value = process.env[key];
  return value === undefined || value === null
    ? fallback
    : String(value).trim();
};

const NODE_ENV = getEnvValue("NODE_ENV", "development").toLowerCase();
const isProduction = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

const required = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_PORT",
  "JWT_SECRET",
  "OTP_SECRET",
];

if (isProduction) {
  required.push("CORS_ORIGIN");
}

const missing = required.filter((key) => !getEnvValue(key));
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const JWT_SECRET = getEnvValue("JWT_SECRET");
const OTP_SECRET = getEnvValue("OTP_SECRET");

if (JWT_SECRET.length < 64) {
  throw new Error("JWT_SECRET must be at least 64 characters long.");
}

if (OTP_SECRET.length < 64) {
  throw new Error("OTP_SECRET must be at least 64 characters long.");
}

if (JWT_SECRET === OTP_SECRET) {
  throw new Error("JWT_SECRET and OTP_SECRET must be different secrets.");
}

const DB_PORT = Number(getEnvValue("DB_PORT"));
if (!Number.isInteger(DB_PORT) || DB_PORT <= 0 || DB_PORT > 65535) {
  throw new Error("DB_PORT must be a valid integer between 1 and 65535.");
}

const PORT = Number(getEnvValue("PORT", "5000"));
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error("PORT must be a valid integer between 1 and 65535.");
}

const CLOUDINARY_CLOUD_NAME = getEnvValue("CLOUDINARY_CLOUD_NAME");
const CLOUDINARY_API_KEY = getEnvValue("CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = getEnvValue("CLOUDINARY_API_SECRET");

if (isProduction) {
  const missingCloudinary = [
    ["CLOUDINARY_CLOUD_NAME", CLOUDINARY_CLOUD_NAME],
    ["CLOUDINARY_API_KEY", CLOUDINARY_API_KEY],
    ["CLOUDINARY_API_SECRET", CLOUDINARY_API_SECRET],
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missingCloudinary.length) {
    throw new Error(`Cloudinary credentials are required in production: ${missingCloudinary.join(", ")}`);
  }
}

const SMTP_HOST = getEnvValue("SMTP_HOST");
const SMTP_PORT = Number(getEnvValue("SMTP_PORT", "587"));
const SMTP_USER = getEnvValue("SMTP_USER");
const SMTP_PASSWORD = getEnvValue("SMTP_PASSWORD");
const SMTP_SECURE = getEnvValue("SMTP_SECURE", "false").toLowerCase() === "true";
const SMTP_FROM = getEnvValue("SMTP_FROM", SMTP_USER);
const BACKUP_DIR = getEnvValue("BACKUP_DIR", path.join(__dirname, "..", "backups"));

if (!Number.isInteger(SMTP_PORT) || SMTP_PORT <= 0 || SMTP_PORT > 65535) {
  throw new Error("SMTP_PORT must be a valid integer between 1 and 65535.");
}

if (isProduction) {
  const missingSmtp = [
    ["SMTP_HOST", SMTP_HOST],
    ["SMTP_USER", SMTP_USER],
    ["SMTP_PASSWORD", SMTP_PASSWORD],
    ["SMTP_FROM", SMTP_FROM],
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missingSmtp.length) {
    throw new Error(`SMTP configuration is required in production: ${missingSmtp.join(", ")}`);
  }

  if (SMTP_PASSWORD.includes("YOUR_") || SMTP_PASSWORD.includes("REPLACE_")) {
    throw new Error("SMTP_PASSWORD still contains a placeholder value.");
  }
}

module.exports = {
  NODE_ENV,
  isProduction,
  isDevelopment: NODE_ENV === "development",
  isTest,
  PORT,
  DB_HOST: getEnvValue("DB_HOST"),
  DB_USER: getEnvValue("DB_USER"),
  DB_PASSWORD: getEnvValue("DB_PASSWORD"),
  DB_NAME: getEnvValue("DB_NAME"),
  DB_PORT,
  JWT_SECRET,
  OTP_SECRET,
  DEFAULT_PHONE_COUNTRY_CODE: getEnvValue("DEFAULT_PHONE_COUNTRY_CODE", "20"),
  JWT_EXPIRES_IN: getEnvValue("JWT_EXPIRES_IN", "7d"),
  CORS_ORIGIN: getEnvValue("CORS_ORIGIN", getEnvValue("FRONTEND_URL")),
  FRONTEND_URL: getEnvValue("FRONTEND_URL"),
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  SMTP_SECURE,
  SMTP_FROM,
  BACKUP_DIR,
};
