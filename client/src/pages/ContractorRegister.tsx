import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useContractorAuth } from "../context/ContractorAuthContext";
import { buttonPrimary, cardClass, inputClass, labelClass } from "../components/ui";
import DateField from "../components/DateField";

export default function ContractorRegister() {
  const { t } = useTranslation();
  const { siteId } = useParams<{ siteId: string }>();
  const { registerWithForm } = useContractorAuth();
  const navigate = useNavigate();
  const [site, setSite] = useState<{ id: string; name: string; location: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [goodStandingExpiry, setGoodStandingExpiry] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    api
      .get(`/contractors/site/${siteId}/info`)
      .then((res) => setSite(res.data))
      .catch(() => setNotFound(true));
  }, [siteId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    setError(null);
    if (password.length < 8) {
      setError(t("contractorRegister.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("contractorRegister.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("companyName", companyName);
      if (registrationNumber) form.append("registrationNumber", registrationNumber);
      form.append("scopeOfWork", scopeOfWork);
      form.append("contactName", contactName);
      if (contactPhone) form.append("contactPhone", contactPhone);
      form.append("contactEmail", contactEmail);
      form.append("contractStartDate", contractStartDate);
      form.append("contractEndDate", contractEndDate);
      if (goodStandingExpiry) form.append("goodStandingExpiry", goodStandingExpiry);
      if (insuranceExpiry) form.append("insuranceExpiry", insuranceExpiry);
      form.append("password", password);
      await registerWithForm(siteId, form);
      navigate("/contractor-portal");
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("contractorRegister.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 p-4">
        <div className={`${cardClass} p-6 max-w-md text-center`}>{t("contractorRegister.siteNotFound")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mine-950 flex items-center justify-center p-4">
      <div className={`${cardClass} p-6 w-full max-w-lg space-y-5`}>
        <div>
          <div className="text-lg font-bold tracking-tight">⛏ Mine Guard</div>
          <h1 className="text-base font-semibold mt-2">{t("contractorRegister.title")}</h1>
          {site && <p className="text-mine-300 text-sm">{t("contractorRegister.subtitle", { site: site.name })}</p>}
        </div>

        {error && <div className="text-danger-500 text-sm bg-danger-500/10 border border-danger-500/30 rounded-md px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("contractors.companyName")}</label>
              <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("contractors.registrationNumber")}</label>
              <input className={inputClass} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("contractors.scopeOfWork")}</label>
            <textarea className={inputClass} rows={2} value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("contractors.contactName")}</label>
              <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("common.phone")}</label>
              <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("contractors.contactEmail")}</label>
            <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
            <p className="text-[10px] text-mine-400 mt-1">{t("contractorRegister.emailHint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("contractors.contractStartDate")}</label>
              <DateField value={contractStartDate} onChange={setContractStartDate} required />
            </div>
            <div>
              <label className={labelClass}>{t("contractors.contractEndDate")}</label>
              <DateField value={contractEndDate} onChange={setContractEndDate} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("contractors.goodStandingExpiry")}</label>
              <DateField value={goodStandingExpiry} onChange={setGoodStandingExpiry} />
            </div>
            <div>
              <label className={labelClass}>{t("contractors.insuranceExpiry")}</label>
              <DateField value={insuranceExpiry} onChange={setInsuranceExpiry} />
            </div>
          </div>

          <div className="text-xs font-semibold text-mine-300 uppercase pt-2 border-t border-mine-800">
            {t("contractorRegister.sectionAccount")}
          </div>
          <p className="text-xs text-mine-400">{t("contractorRegister.accountHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("contractorRegister.password")}</label>
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <div>
              <label className={labelClass}>{t("contractorRegister.confirmPassword")}</label>
              <input className={inputClass} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
            </div>
          </div>

          <button type="submit" className={`${buttonPrimary} w-full`} disabled={submitting}>
            {submitting ? t("common.saving") : t("contractorRegister.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
