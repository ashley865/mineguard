import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { LogoMark, Wordmark } from "../components/Logo";

export default function Login() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, mfaCode || undefined);
    } catch (err: any) {
      if (err.response?.data?.mfaRequired) {
        setMfaRequired(true);
        setError(mfaCode ? (err.response?.data?.error ?? t("login.mfaInvalid")) : null);
      } else {
        setError(err.response?.data?.error ?? t("login.error"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mine-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div className="flex justify-center"><LogoMark size={44} /></div>
          <div className="text-2xl font-bold tracking-tight mt-2"><Wordmark /></div>
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
              disabled={mfaRequired}
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
              disabled={mfaRequired}
              required
            />
          </div>
          {mfaRequired && (
            <div>
              <label className={labelClass}>{t("login.mfaCode")}</label>
              <input
                className={inputClass}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="000000"
                autoFocus
                required
              />
              <p className="text-[11px] text-mine-400 mt-1">{t("login.mfaCodeHint")}</p>
            </div>
          )}
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
        <div className="text-center mt-4">
          <Link to="/privacy-policy" className="text-xs text-mine-500 hover:text-mine-300 underline">
            {t("login.privacyPolicy")}
          </Link>
        </div>
      </div>
    </div>
  );
}
