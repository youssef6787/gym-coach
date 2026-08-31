const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "../..");
const backendRoot = path.join(projectRoot, "backend");

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail });

let env = null;
try {
  env = require("../config/env");
  add("production environment validates", env.isProduction === true, "Set NODE_ENV=production before the production verification command.");
} catch (error) {
  add("production environment validates", false, error.message);
}

add("frontend environment template exists", fs.existsSync(path.join(projectRoot, ".env.example")), "Missing .env.example.");
add("backend environment template exists", fs.existsSync(path.join(backendRoot, ".env.example")), "Missing backend/.env.example.");
add("production nginx config exists", fs.existsSync(path.join(projectRoot, "deploy", "nginx.conf")), "Missing deploy/nginx.conf.");
add("production compose exists", fs.existsSync(path.join(projectRoot, "docker-compose.production.yml")), "Missing docker-compose.production.yml.");
add("backend production Dockerfile exists", fs.existsSync(path.join(backendRoot, "Dockerfile")), "Missing backend/Dockerfile.");

const sourceRoots = [path.join(projectRoot, "src"), backendRoot];
const ignored = new Set(["node_modules", "dist", "backups", "uploads", "verifyProduction.js", "smokeTest.js"]);
const suspicious = /(?:localhost:5000|127\.0\.0\.1:5000)/i;

const walk = (dir) => {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(js|jsx|ts|tsx|json|css|html|env|yml|yaml)$/i.test(entry.name)) files.push(full);
  }
  return files;
};

const badLocalRefs = [];
for (const root of sourceRoots) {
  for (const file of walk(root)) {
    try {
      const text = fs.readFileSync(file, "utf8");
      if (suspicious.test(text)) badLocalRefs.push(path.relative(projectRoot, file));
    } catch {}
  }
}

add("no production localhost API references", badLocalRefs.length === 0, badLocalRefs.join(", "));

if (env?.isProduction) {
  add("Cloudinary configured", Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET), "Production media requires Cloudinary.");
  add("SMTP configured", Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM), "Production OTP email requires SMTP.");
  add("CORS configured", Boolean(env.CORS_ORIGIN), "Set CORS_ORIGIN to the exact frontend origin(s).");
}

console.log("\nProduction verification\n========================");
let failed = false;
for (const check of checks) {
  console.log(`${check.ok ? "✅" : "❌"} ${check.name}${check.ok ? "" : ` — ${check.detail}`}`);
  if (!check.ok) failed = true;
}

process.exit(failed ? 1 : 0);
