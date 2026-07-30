import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { buttonPrimary, cardClass, inputClass, labelClass } from "../components/ui";

export default function VisitorCheckIn() {
  const { t } = useTranslation();
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<{ id: string; name: string; location: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [company, setCompany] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [hostName, setHostName] = useState("");
  const [purposeOfVisit, setPurposeOfVisit] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [documents, setDocuments] = useState<FileList | null>(null);
  const [inductionAcknowledged, setInductionAcknowledged] = useState(false);
  const [popiaConsentAccepted, setPopiaConsentAccepted] = useState(false);
  const [indemnityAccepted, setIndemnityAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ checkInAt: string } | null>(null);

  useEffect(() => {
    if (!siteId) return;
    api
      .get(`/visitors/site/${siteId}/info`)
      .then((res) => setSite(res.data))
      .catch(() => setNotFound(true));
  }, [siteId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    setError(null);

    if (!inductionAcknowledged || !popiaConsentAccepted || !indemnityAccepted) {
      setError(t("visitorCheckin.declarationsRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("fullName", fullName);
      form.append("idNumber", idNumber);
      if (company) form.append("company", company);
      form.append("contactPhone", contactPhone);
      if (contactEmail) form.append("contactEmail", contactEmail);
      form.append("hostName", hostName);
      form.append("purposeOfVisit", purposeOfVisit);
      if (vehicleRegistration) form.append("vehicleRegistration", vehicleRegistration);
      form.append("inductionAcknowledged", "true");
      form.append("popiaConsentAccepted", "true");
      form.append("indemnityAccepted", "true");
      if (documents) {
        Array.from(documents).forEach((file) => form.append("documents", file));
      }
      const res = await api.post(`/visitors/checkin/${siteId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDone({ checkInAt: res.data.checkInAt });
    } catch {
      setError(t("visitorCheckin.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4">
        <div className={`${cardClass} p-6 max-w-md text-center`}>{t("visitorCheckin.siteNotFound")}</div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4">
        <div className={`${cardClass} p-8 max-w-md text-center space-y-3`}>
          <div className="text-3xl">✅</div>
          <h1 className="text-lg font-bold">{t("visitorCheckin.successTitle")}</h1>
          <p className="text-mine-300 text-sm">
            {t("visitorCheckin.successBody", { time: new Date(done.checkInAt).toLocaleString() })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center p-4">
      <div className={`${cardClass} p-6 w-full max-w-lg space-y-5`}>
        <div>
          <div className="text-lg font-bold tracking-tight">⛏ Mine Guard</div>
          <h1 className="text-base font-semibold mt-2">{t("visitorCheckin.title")}</h1>
          {site && <p className="text-mine-300 text-sm">{t("visitorCheckin.subtitle", { site: site.name })}</p>}
        </div>

        {error && <div className="text-danger-500 text-sm bg-danger-500/10 border border-danger-500/30 rounded-md px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("visitorCheckin.fullName")}</label>
              <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("visitorCheckin.idNumber")}</label>
              <input className={inputClass} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("visitorCheckin.company")}</label>
              <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("visitorCheckin.vehicleRegistration")}</label>
              <input className={inputClass} value={vehicleRegistration} onChange={(e) => setVehicleRegistration(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("visitorCheckin.contactPhone")}</label>
              <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("visitorCheckin.contactEmail")}</label>
              <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("visitorCheckin.hostName")}</label>
            <input className={inputClass} value={hostName} onChange={(e) => setHostName(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t("visitorCheckin.purposeOfVisit")}</label>
            <textarea className={inputClass} rows={2} value={purposeOfVisit} onChange={(e) => setPurposeOfVisit(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t("visitorCheckin.documents")}</label>
            <input
              className={inputClass}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => setDocuments(e.target.files)}
            />
            <p className="text-xs text-mine-400 mt-1">{t("visitorCheckin.documentsHint")}</p>
          </div>

          <div className="space-y-2 border border-mine-800 rounded-md p-3 bg-mine-900/40">
            <p className="text-xs text-mine-400">{t("visitorCheckin.declarationsIntro")}</p>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={inductionAcknowledged} onChange={(e) => setInductionAcknowledged(e.target.checked)} />
              <span>{t("visitorCheckin.inductionDeclaration")}</span>
            </label>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={popiaConsentAccepted} onChange={(e) => setPopiaConsentAccepted(e.target.checked)} />
              <span>{t("visitorCheckin.popiaDeclaration")}</span>
            </label>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={indemnityAccepted} onChange={(e) => setIndemnityAccepted(e.target.checked)} />
              <span>{t("visitorCheckin.indemnityDeclaration")}</span>
            </label>
          </div>

          <button type="submit" className={`${buttonPrimary} w-full`} disabled={submitting}>
            {submitting ? t("common.saving") : t("visitorCheckin.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
