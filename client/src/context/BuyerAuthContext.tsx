import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { buyerApi } from "../api/buyerClient";
import { Buyer } from "../api/types";

interface BuyerAuthContextValue {
  buyer: Buyer | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerWithForm: (form: FormData) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshBuyer: () => Promise<void>;
  logout: () => void;
}

const BuyerAuthContext = createContext<BuyerAuthContextValue | undefined>(undefined);

export function BuyerAuthProvider({ children }: { children: ReactNode }) {
  const [buyer, setBuyer] = useState<Buyer | null>(() => {
    const stored = localStorage.getItem("mineguard_buyer");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem("mineguard_buyer");
      localStorage.removeItem("mineguard_buyer_token");
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("mineguard_buyer_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (token) {
        try {
          const res = await buyerApi.get<Buyer>("/buyer-auth/me");
          setBuyer(res.data);
          localStorage.setItem("mineguard_buyer", JSON.stringify(res.data));
        } catch (err: any) {
          if (err?.response?.status === 401) {
            setBuyer(null);
            setToken(null);
            localStorage.removeItem("mineguard_buyer_token");
            localStorage.removeItem("mineguard_buyer");
          }
        }
      }
      setLoading(false);
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(newToken: string, newBuyer: Buyer) {
    localStorage.setItem("mineguard_buyer_token", newToken);
    localStorage.setItem("mineguard_buyer", JSON.stringify(newBuyer));
    setToken(newToken);
    setBuyer(newBuyer);
  }

  async function login(email: string, password: string) {
    const res = await buyerApi.post("/buyer-auth/login", { email, password });
    persist(res.data.token, res.data.buyer);
  }

  async function registerWithForm(form: FormData) {
    const res = await buyerApi.post("/buyers/register", form, { headers: { "Content-Type": "multipart/form-data" } });
    persist(res.data.token, res.data.buyer);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await buyerApi.post("/buyer-auth/change-password", { currentPassword, newPassword });
  }

  async function refreshBuyer() {
    const res = await buyerApi.get<Buyer>("/buyer-auth/me");
    localStorage.setItem("mineguard_buyer", JSON.stringify(res.data));
    setBuyer(res.data);
  }

  function logout() {
    localStorage.removeItem("mineguard_buyer_token");
    localStorage.removeItem("mineguard_buyer");
    setToken(null);
    setBuyer(null);
  }

  return (
    <BuyerAuthContext.Provider value={{ buyer, token, loading, login, registerWithForm, changePassword, refreshBuyer, logout }}>
      {children}
    </BuyerAuthContext.Provider>
  );
}

export function useBuyerAuth() {
  const ctx = useContext(BuyerAuthContext);
  if (!ctx) throw new Error("useBuyerAuth must be used within BuyerAuthProvider");
  return ctx;
}
