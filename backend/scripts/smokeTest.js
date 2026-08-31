const baseUrl = String(process.env.SMOKE_TEST_URL || `http://127.0.0.1:${process.env.PORT || 5000}`).replace(/\/+$/, "");

(async () => {
  const response = await fetch(`${baseUrl}/`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success !== true) {
    throw new Error(`Health check failed: HTTP ${response.status}`);
  }

  console.log(`✅ API health check passed: ${baseUrl}`);
})().catch((error) => {
  console.error(`❌ API smoke test failed: ${error.message}`);
  process.exit(1);
});
