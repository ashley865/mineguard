import axios from "axios";
import { API_URL } from "./client";

// Deliberately separate from the staff `api` client and the buyer/contractor clients: a
// platform admin is a fourth, distinct principal type (see server/src/middleware/
// platformAdminAuth.ts) with no relation to any Mine/User, so its token, storage keys and
// 401 redirect must never cross with any of the others.
export const platformAdminApi = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
});

platformAdminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("mineguard_platform_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

platformAdminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mineguard_platform_admin_token");
      localStorage.removeItem("mineguard_platform_admin");
      if (window.location.pathname !== "/platform-admin/login") {
        window.location.href = "/platform-admin/login";
      }
    }
    return Promise.reject(error);
  }
);
