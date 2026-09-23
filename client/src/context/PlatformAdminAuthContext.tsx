import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { platformAdminApi } from "../api/platformAdminClient";
import { PlatformAdmin } from "../api/types";

interface PlatformAdminAuthContextValue {
  admin: PlatformAdmin | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
}

const PlatformAdminAuthContext = createContext<PlatformAdminAuthContextValue | undefined>(undefined);

export function PlatformAdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(() => {
    const stored = localStorage.getItem("mineguard_platform_admin");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem("mineguard_platform_admin");
      localStorage.removeItem("mineguard_platform_admin_token");
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("mineguard_platform_admin_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (token) {
        try {
          const res = await platformAdminApi.get<PlatformAdmin>("/platform-admin/auth/me");
          setAdmin(res.data);
          localStorage.setItem("mineguard_platform_admin", JSON.stringify(res.data));
        } catch (err: any) {
          if (err?.response?.status === 401) {
            setAdmin(null);
            setToken(null);
            localStorage.removeItem("mineguard_platform_admin_token");
            localStorage.removeItem("mineguard_platform_admin");
          }
        }
      }
      setLoading(false);
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(newToken: string, newAdmin: PlatformAdmin) {
    localStorage.setItem("mineguard_platform_admin_token", newToken);
    localStorage.setItem("mineguard_platform_admin", JSON.stringify(newAdmin));
    setToken(newToken);
    setAdmin(newAdmin);
  }

  async function login(email: string, password: string) {
    const res = await platformAdminApi.post("/platform-admin/auth/login", { email, password });
    persist(res.data.token, res.data.admin);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await platformAdminApi.post("/platform-admin/auth/change-password", { currentPassword, newPassword });
  }

  function logout() {
    localStorage.removeItem("mineguard_platform_admin_token");
    localStorage.removeItem("mineguard_platform_admin");
    setToken(null);
    setAdmin(null);
  }

  return (
    <PlatformAdminAuthContext.Provider value={{ admin, token, loading, login, changePassword, logout }}>
      {children}
    </PlatformAdminAuthContext.Provider>
  );
}

export function usePlatformAdminAuth() {
  const ctx = useContext(PlatformAdminAuthContext);
  if (!ctx) throw new Error("usePlatformAdminAuth must be used within PlatformAdminAuthProvider");
  return ctx;
}
