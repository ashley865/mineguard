import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  // Without this, a hung/unreachable server (e.g. a free-tier host waking from
  // sleep, or a dropped connection) leaves the request pending forever — the
  // promise never resolves or rejects, so callers relying on try/catch/finally
  // (including AuthContext's initial /auth/me check, which gates the entire
  // app behind a loading screen) never get the chance to recover.
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mineguard_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mineguard_token");
      localStorage.removeItem("mineguard_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
