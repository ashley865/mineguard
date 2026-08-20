import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBuyerAuth } from "../context/BuyerAuthContext";
import { buttonPrimary, cardClass, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { LogoMark, Wordmark } from "../components/Logo";

export default function BuyerLogin() {
  const { t } = useTranslation();
  const { login } = useBuyerAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/buyer-portal");
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("buyerLogin.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-mine-950 flex items-center justify-center p-4">
      <div className={`${cardClass} p-6 sm:p-8 w-full max-w-sm space-y-5`}>
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div>
          <div className="text-lg font-bold tracking-tight flex items-center gap-2"><LogoMark size={20} /><Wordmark /></div>
          <h1 className="text-base font-semibold mt-2">{t("buyerLogin.title")}</h1>
          <p className="text-mine-300 text-sm">{t("buyerLogin.subtitle")}</p>
        </div>

        {error && <div className="text-danger-500 text-sm bg-danger-500/10 border border-danger-500/30 rounded-md px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>{t("buyerLogin.email")}</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className={labelClass}>{t("buyerLogin.password")}</label>
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`} disabled={submitting}>
            {submitting ? t("buyerLogin.signingIn") : t("buyerLogin.signIn")}
          </button>
        </form>

        <div className="text-xs text-mine-400 text-center space-y-1">
          <div>
            {t("buyerLogin.noAccount")}{" "}
            <Link to="/buyer-register" className="text-hazard-500 hover:underline">{t("buyerLogin.registerLink")}</Link>
          </div>
          <div>
            <Link to="/buy" className="text-mine-400 hover:underline">{t("buyerLogin.backToMarketplace")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
