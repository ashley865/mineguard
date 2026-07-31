import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { buttonPrimary, cardClass, inputClass, labelClass } from "../components/ui";

export default function ContractorRegister() {
  const { t } = useTranslation();
  const { siteId } = useParams<{ siteId: string }>();
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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    setSubmitting(true);
    try {
      await api.post(`/contractors/register/${siteId}`, {
        companyName,
        registrationNumber: registrationNumber || undefined,
        scopeOfWork,
        contactName,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        contractStartDate,
        contractEndDate,
        goodStandingExpiry: goodStandingExpiry || null,
        insuranceExpiry: insuranceExpiry || null,
      });
      setDone(true);
    } catch {
      setError(t("contractorRegister.submitError"));
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

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 p-4">
        <div className={`${cardClass} p-8 max-w-md text-center space-y-3`}>
          <h1 className="text-lg font-bold">{t("contractorRegister.successTitle")}</h1>
          <p className="text-mine-300 text-sm">{t("contractorRegister.successBody")}</p>
        </div>
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
            <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("contractors.contractStartDate")}</label>
              <input className={inputClass} type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("contractors.contractEndDate")}</label>
              <input className={inputClass} type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("contractors.goodStandingExpiry")}</label>
              <input className={inputClass} type="date" value={goodStandingExpiry} onChange={(e) => setGoodStandingExpiry(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("contractors.insuranceExpiry")}</label>
              <input className={inputClass} type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} />
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
