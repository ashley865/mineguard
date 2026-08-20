import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";
import { Mine, User } from "../api/types";

export interface RegisterMinePayload {
  mineName: string;
  location: string;
  registrationNumber?: string;
  miningRightNumber?: string;
  description?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  register: (email: string, password: string, name: string, mineId: string, passkey: string) => Promise<void>;
  registerMine: (payload: RegisterMinePayload) => Promise<{ mine: Mine; passkey: string }>;
  acceptExecutiveInvite: (inviteId: string, key: string, password: string) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("mineguard_user");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem("mineguard_user");
      localStorage.removeItem("mineguard_token");
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("mineguard_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (token) {
        try {
          const res = await api.get<User>("/auth/me");
          setUser(res.data);
          localStorage.setItem("mineguard_user", JSON.stringify(res.data));
        } catch (err: any) {
          // Only a genuine 401 means the token is actually invalid. A network
          // error or timeout (server cold-starting, connection dropped) is not
          // proof the session is bad — logging the user out in that case would
          // just bounce them to /login while the server wakes up, which looks
          // identical to "the site is broken" from their side.
          if (err?.response?.status === 401) {
            setUser(null);
            setToken(null);
            localStorage.removeItem("mineguard_token");
            localStorage.removeItem("mineguard_user");
          }
        }
      }
      setLoading(false);
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(newToken: string, newUser: User) {
    localStorage.setItem("mineguard_token", newToken);
    localStorage.setItem("mineguard_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  async function login(email: string, password: string, mfaCode?: string) {
    const res = await api.post("/auth/login", { email, password, mfaCode: mfaCode || undefined });
    persist(res.data.token, res.data.user);
  }

  async function register(email: string, password: string, name: string, mineId: string, passkey: string) {
    const res = await api.post("/auth/register", { email, password, name, mineId, passkey });
    persist(res.data.token, res.data.user);
  }

  async function registerMine(payload: RegisterMinePayload) {
    const res = await api.post("/mines/register", payload);
    persist(res.data.token, res.data.user);
    return { mine: res.data.mine as Mine, passkey: res.data.passkey as string };
  }

  async function acceptExecutiveInvite(inviteId: string, key: string, password: string) {
    const res = await api.post(`/executive-invites/${inviteId}/accept`, { key, password });
    persist(res.data.token, res.data.user);
  }

  async function updateProfile(name: string) {
    const res = await api.put("/auth/me", { name });
    const newUser = res.data as User;
    localStorage.setItem("mineguard_user", JSON.stringify(newUser));
    setUser(newUser);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await api.post("/auth/change-password", { currentPassword, newPassword });
  }

  async function refreshUser() {
    const res = await api.get<User>("/auth/me");
    localStorage.setItem("mineguard_user", JSON.stringify(res.data));
    setUser(res.data);
  }

  function logout() {
    localStorage.removeItem("mineguard_token");
    localStorage.removeItem("mineguard_user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        registerMine,
        acceptExecutiveInvite,
        updateProfile,
        changePassword,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
