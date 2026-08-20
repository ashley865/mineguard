import axios from "axios";
import { API_URL } from "./client";

// Deliberately separate from the staff `api` client and the `buyerApi` client — a third
// principal type with its own token, storage key, and 401 handling, same reasoning as
// buyerClient.ts.
export const contractorApi = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
});

contractorApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("mineguard_contractor_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

contractorApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mineguard_contractor_token");
      localStorage.removeItem("mineguard_contractor");
      if (window.location.pathname !== "/contractor-login") {
        window.location.href = "/contractor-login";
      }
    }
    return Promise.reject(error);
  }
);
