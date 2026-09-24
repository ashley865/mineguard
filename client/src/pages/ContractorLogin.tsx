import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useContractorAuth } from "../context/ContractorAuthContext";
import { contractorApi } from "../api/contractorClient";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { LogoMark, Wordmark } from "../components/Logo";

export default function ContractorLogin() {
  const { t } = useTranslation();
  const { login } = useContractorAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailUnverified(false);
    setResent(false);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/contractor-portal");
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("contractorLogin.error"));
      setEmailUnverified(!!err.response?.data?.emailUnverified);
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    setSubmitting(true);
    try {
      await contractorApi.post("/contractor-auth/resend-verification", { email });
      setResent(true);
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
          <h1 className="text-base font-semibold mt-2">{t("contractorLogin.title")}</h1>
          <p className="text-mine-300 text-sm">{t("contractorLogin.subtitle")}</p>
        </div>

        {error && (
          <div className="text-danger-500 text-sm bg-danger-500/10 border border-danger-500/30 rounded-md px-3 py-2 space-y-2">
            <p>{error}</p>
            {emailUnverified && !resent && (
              <button type="button" className={`${buttonSecondary} text-xs`} onClick={resendVerification} disabled={submitting}>
                {t("contractorLogin.resendVerification")}
              </button>
            )}
            {resent && <p className="text-mine-300 text-xs">{t("contractorLogin.verificationResent")}</p>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>{t("contractorLogin.email")}</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className={labelClass}>{t("contractorLogin.password")}</label>
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`} disabled={submitting}>
            {submitting ? t("contractorLogin.signingIn") : t("contractorLogin.signIn")}
          </button>
        </form>

        <p className="text-xs text-mine-400 text-center">{t("contractorLogin.noAccountHint")}</p>
      </div>
    </div>
  );
}
