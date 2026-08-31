const rawApiUrl = String(import.meta.env.VITE_API_URL || "").trim();

if (import.meta.env.PROD && !rawApiUrl) {
  throw new Error(
    "VITE_API_URL is required for production builds. Set it to the public HTTPS API URL."
  );
}

const API_URL = rawApiUrl.replace(/\/+$/, "");

export const apiUrl = (path = "") => {
  if (!path) return API_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

export { API_URL };
export default API_URL;
