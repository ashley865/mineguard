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
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    role: "ADMIN" | "EXECUTIVE",
    mineId: string,
    passkey: string
  ) => Promise<void>;
  registerMine: (payload: RegisterMinePayload) => Promise<{ mine: Mine; passkey: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("mineguard_user");
    return stored ? JSON.parse(stored) : null;
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
        } catch {
          setUser(null);
          setToken(null);
          localStorage.removeItem("mineguard_token");
          localStorage.removeItem("mineguard_user");
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

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    persist(res.data.token, res.data.user);
  }

  async function register(
    email: string,
    password: string,
    name: string,
    role: "ADMIN" | "EXECUTIVE",
    mineId: string,
    passkey: string
  ) {
    const res = await api.post("/auth/register", { email, password, name, role, mineId, passkey });
    persist(res.data.token, res.data.user);
  }

  async function registerMine(payload: RegisterMinePayload) {
    const res = await api.post("/mines/register", payload);
    persist(res.data.token, res.data.user);
    return { mine: res.data.mine as Mine, passkey: res.data.passkey as string };
  }

  function logout() {
    localStorage.removeItem("mineguard_token");
    localStorage.removeItem("mineguard_user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, registerMine, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
