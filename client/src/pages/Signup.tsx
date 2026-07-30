import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { Mine } from "../api/types";
import { buttonPrimary, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Signup() {
  const { t } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mineQuery, setMineQuery] = useState("");
  const [mineResults, setMineResults] = useState<Mine[]>([]);
  const [selectedMine, setSelectedMine] = useState<Mine | null>(null);
  const [passkey, setPasskey] = useState("");

  useEffect(() => {
    if (selectedMine || mineQuery.trim().length < 2) {
      setMineResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await api.get<Mine[]>("/mines/search", { params: { q: mineQuery } });
      setMineResults(res.data);
    }, 300);
    return () => clearTimeout(handle);
  }, [mineQuery, selectedMine]);

  useEffect(() => {
    const mineId = searchParams.get("mine");
    const key = searchParams.get("key");
    if (!mineId || !key) return;
    api
      .get<Mine>(`/mines/${mineId}`)
      .then((res) => {
        setSelectedMine(res.data);
        setPasskey(key);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedMine) {
      setError(t("signup.mineRequired"));
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name, selectedMine.id, passkey);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error?.formErrors?.[0] ?? err.response?.data?.error ?? t("signup.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mine-950 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div className="text-4xl">⛏</div>
          <div className="text-2xl font-bold tracking-tight mt-1">Mine Guard</div>
          <div className="text-mine-300 text-sm mt-1">{t("signup.title")}</div>
        </div>
        <form onSubmit={handleSubmit} className="bg-mine-900 border border-mine-800 rounded-xl shadow-xl shadow-black/10 p-6 space-y-4">
          <div>
            <label className={labelClass}>{t("signup.mine")}</label>
            {selectedMine ? (
              <div className="flex items-center justify-between bg-mine-800 border border-mine-700 rounded-md px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{selectedMine.name}</div>
                  <div className="text-xs text-mine-400">{selectedMine.location}</div>
                </div>
                <button
                  type="button"
                  className="text-xs text-mine-300 underline hover:text-mine-50"
                  onClick={() => { setSelectedMine(null); setMineQuery(""); setPasskey(""); }}
                >
                  {t("signup.change")}
                </button>
              </div>
            ) : (
              <>
                <input
                  className={inputClass}
                  value={mineQuery}
                  onChange={(e) => setMineQuery(e.target.value)}
                  placeholder={t("signup.mineSearchPlaceholder") ?? ""}
                />
                {mineResults.length > 0 && (
                  <div className="mt-1 border border-mine-700 rounded-md overflow-hidden">
                    {mineResults.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-mine-800"
                        onClick={() => setSelectedMine(m)}
                      >
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-mine-400">{m.location}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {selectedMine && (
            <div>
              <label className={labelClass}>{t("signup.passkey")}</label>
              <input
                className={`${inputClass} font-mono`}
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                required
              />
              <div className="text-xs text-mine-400 mt-1">{t("signup.passkeyHint")}</div>
            </div>
          )}
          <div>
            <label className={labelClass}>{t("signup.fullName")}</label>
            <input
              className={inputClass}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t("signup.email")}</label>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t("signup.password")}</label>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <div className="text-xs text-mine-400 mt-1">{t("signup.passwordHint")}</div>
          </div>
          <div className="text-xs text-mine-400 bg-mine-800/40 border border-mine-800 rounded-md p-3">
            {t("signup.adminOnlyNote")}
          </div>
          {error && <div className="text-danger-400 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className={`${buttonPrimary} w-full`}>
            {loading ? t("signup.creatingAccount") : t("signup.createAccount")}
          </button>
          <div className="text-xs text-mine-400 pt-2 border-t border-mine-800 text-center">
            {t("signup.alreadyHaveAccount")}{" "}
            <Link to="/login" className="text-mine-300 underline hover:text-mine-100">
              {t("signup.signIn")}
            </Link>
            {" · "}
            <Link to="/register-mine" className="text-mine-300 underline hover:text-mine-100">
              {t("signup.registerNewMine")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
