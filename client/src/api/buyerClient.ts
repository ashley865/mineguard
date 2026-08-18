import axios from "axios";
import { API_URL } from "./client";

// Deliberately separate from the staff `api` client (see client.ts) rather than sharing it:
// the two principal types (staff vs. buyer) use different tokens, different storage keys,
// and a 401 on one must never clear or redirect the other's session.
export const buyerApi = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
});

buyerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("mineguard_buyer_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

buyerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mineguard_buyer_token");
      localStorage.removeItem("mineguard_buyer");
      if (window.location.pathname !== "/buyer-login") {
        window.location.href = "/buyer-login";
      }
    }
    return Promise.reject(error);
  }
);
