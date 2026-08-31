const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = require("../config/env");

const ROOT = path.join(__dirname, "..");
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(ROOT, "backups"));
const RETENTION_DAILY = Number(process.env.BACKUP_RETENTION_DAILY || 7);
const RETENTION_WEEKLY = Number(process.env.BACKUP_RETENTION_WEEKLY || 4);
const RETENTION_MONTHLY = Number(process.env.BACKUP_RETENTION_MONTHLY || 3);

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const candidates = [
  process.env.MYSQLDUMP_PATH,
  "mysqldump",
  "C:\\xampp\\mysql\\bin\\mysqldump.exe",
  "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
  "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe",
].filter(Boolean);

const findMysqldump = () => candidates.find((candidate) => {
  if (candidate === "mysqldump") return true;
  try { return fs.existsSync(candidate); } catch { return false; }
});

const mysqldump = findMysqldump();
if (!mysqldump) {
  console.error("❌ mysqldump was not found. Set MYSQLDUMP_PATH if needed.");
  process.exit(1);
}

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
const backupFile = path.join(BACKUP_DIR, `gym-coach-${stamp}.sql`);

console.log(`Starting database backup: ${backupFile}`);

const args = [
  `--host=${DB_HOST}`,
  `--port=${DB_PORT}`,
  `--user=${DB_USER}`,
  "--single-transaction",
  "--quick",
  "--routines",
  "--triggers",
  "--events",
  "--default-character-set=utf8mb4",
  "--set-gtid-purged=OFF",
  DB_NAME,
];

const child = spawn(mysqldump, args, {
  windowsHide: true,
  env: { ...process.env, MYSQL_PWD: DB_PASSWORD },
});

const output = fs.createWriteStream(backupFile, { encoding: "utf8" });
child.stdout.pipe(output);
child.stderr.on("data", (chunk) => process.stderr.write(chunk));

child.on("error", (error) => {
  output.destroy();
  try { fs.unlinkSync(backupFile); } catch {}
  console.error("❌ Backup failed:", error.message);
  process.exit(1);
});

child.on("close", (code) => {
  output.end(() => {
    if (code !== 0) {
      try { fs.unlinkSync(backupFile); } catch {}
      console.error(`❌ mysqldump exited with code ${code}.`);
      process.exit(code || 1);
    }

    console.log(`✅ Backup created: ${backupFile}`);
    pruneBackups();
  });
});

function pruneBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((name) => /^gym-coach-.*\.sql$/i.test(name))
    .map((name) => ({
      name,
      path: path.join(BACKUP_DIR, name),
      time: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs,
    }))
    .sort((a, b) => b.time - a.time);

  const keep = new Set();
  files.slice(0, RETENTION_DAILY).forEach((file) => keep.add(file.name));

  // Keep one representative backup per ISO week and per calendar month.
  const seenWeeks = new Set();
  const seenMonths = new Set();
  for (const file of files) {
    const date = new Date(file.time);
    const year = date.getUTCFullYear();
    const month = `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const firstDay = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((date - firstDay) / 86400000) + firstDay.getUTCDay() + 1) / 7);
    const weekKey = `${year}-W${week}`;

    if (seenWeeks.size < RETENTION_WEEKLY && !seenWeeks.has(weekKey)) {
      seenWeeks.add(weekKey);
      keep.add(file.name);
    }
    if (seenMonths.size < RETENTION_MONTHLY && !seenMonths.has(month)) {
      seenMonths.add(month);
      keep.add(file.name);
    }
  }

  for (const file of files) {
    if (!keep.has(file.name)) {
      try {
        fs.unlinkSync(file.path);
        console.log(`🧹 Removed old backup: ${file.name}`);
      } catch (error) {
        console.warn(`Could not remove ${file.name}: ${error.message}`);
      }
    }
  }
}
