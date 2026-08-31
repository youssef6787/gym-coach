/*
=========================================================
GYM COACH API CONFIG
=========================================================
*/

/*
في Localhost:
Frontend = http://localhost:5173
Backend  = http://localhost:5000

إذا وضعت VITE_API_URL في .env
سيتم استخدامه بدل العنوان الافتراضي.
*/

const rawApiUrl =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const API_URL =
  rawApiUrl.replace(/\/+$/, "");

export { API_URL };

export default API_URL;