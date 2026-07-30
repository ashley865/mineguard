import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Login() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("login.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-fuchsia-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div className="text-4xl">⛏</div>
          <div className="text-2xl font-bold tracking-tight mt-1">Mine Guard</div>
          <div className="text-mine-300 text-sm mt-1">{t("login.tagline")}</div>
        </div>
        <form onSubmit={handleSubmit} className="bg-mine-900 border border-mine-800 rounded-xl shadow-xl shadow-black/10 p-6 space-y-4">
          <div>
            <label className={labelClass}>{t("login.email")}</label>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t("login.password")}</label>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-danger-400 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className={`${buttonPrimary} w-full`}>
            {loading ? t("login.signingIn") : t("login.signIn")}
          </button>
          <Link to="/signup" className={`${buttonSecondary} w-full block text-center`}>
            {t("login.createAccount")}
          </Link>
          <div className="text-xs text-mine-400 text-center pt-1">
            <Link to="/register-mine" className="underline hover:text-mine-100">
              {t("login.registerMine")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
