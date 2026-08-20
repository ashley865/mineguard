import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { contractorApi } from "../api/contractorClient";
import { Contractor } from "../api/types";

interface ContractorAuthContextValue {
  contractor: Contractor | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerWithForm: (siteId: string, form: FormData) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshContractor: () => Promise<void>;
  logout: () => void;
}

const ContractorAuthContext = createContext<ContractorAuthContextValue | undefined>(undefined);

export function ContractorAuthProvider({ children }: { children: ReactNode }) {
  const [contractor, setContractor] = useState<Contractor | null>(() => {
    const stored = localStorage.getItem("mineguard_contractor");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem("mineguard_contractor");
      localStorage.removeItem("mineguard_contractor_token");
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("mineguard_contractor_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (token) {
        try {
          const res = await contractorApi.get<Contractor>("/contractor-auth/me");
          setContractor(res.data);
          localStorage.setItem("mineguard_contractor", JSON.stringify(res.data));
        } catch (err: any) {
          if (err?.response?.status === 401) {
            setContractor(null);
            setToken(null);
            localStorage.removeItem("mineguard_contractor_token");
            localStorage.removeItem("mineguard_contractor");
          }
        }
      }
      setLoading(false);
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(newToken: string, newContractor: Contractor) {
    localStorage.setItem("mineguard_contractor_token", newToken);
    localStorage.setItem("mineguard_contractor", JSON.stringify(newContractor));
    setToken(newToken);
    setContractor(newContractor);
  }

  async function login(email: string, password: string) {
    const res = await contractorApi.post("/contractor-auth/login", { email, password });
    persist(res.data.token, res.data.contractor);
  }

  async function registerWithForm(siteId: string, form: FormData) {
    const res = await contractorApi.post(`/contractors/register/${siteId}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    persist(res.data.token, res.data.contractor);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await contractorApi.post("/contractor-auth/change-password", { currentPassword, newPassword });
  }

  async function refreshContractor() {
    const res = await contractorApi.get<Contractor>("/contractor-auth/me");
    localStorage.setItem("mineguard_contractor", JSON.stringify(res.data));
    setContractor(res.data);
  }

  function logout() {
    localStorage.removeItem("mineguard_contractor_token");
    localStorage.removeItem("mineguard_contractor");
    setToken(null);
    setContractor(null);
  }

  return (
    <ContractorAuthContext.Provider
      value={{ contractor, token, loading, login, registerWithForm, changePassword, refreshContractor, logout }}
    >
      {children}
    </ContractorAuthContext.Provider>
  );
}

export function useContractorAuth() {
  const ctx = useContext(ContractorAuthContext);
  if (!ctx) throw new Error("useContractorAuth must be used within ContractorAuthProvider");
  return ctx;
}
