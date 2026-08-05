import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { api } from "../api/client";
import { buttonPrimary, cardClass, inputClass, labelClass } from "../components/ui";
import { isValidIdOrPassport } from "../lib/saId";
import FileDropzone from "../components/FileDropzone";

const MIN_LEAD_MINUTES = 60;

function defaultScheduledFor() {
  const d = new Date(Date.now() + (MIN_LEAD_MINUTES + 5) * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const [scheduledFor, setScheduledFor] = useState(defaultScheduledFor());
  const [isEmergency, setIsEmergency] = useState(false);
  const [documents, setDocuments] = useState<FileList | null>(null);
  const [inductionAcknowledged, setInductionAcknowledged] = useState(false);
  const [popiaConsentAccepted, setPopiaConsentAccepted] = useState(false);
  const [indemnityAccepted, setIndemnityAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; scheduledFor: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

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
    if (!isValidIdOrPassport(idNumber)) {
      setError(t("visitorCheckin.idNumberInvalid"));
      return;
    }
    if (!isEmergency && new Date(scheduledFor).getTime() - Date.now() < MIN_LEAD_MINUTES * 60 * 1000) {
      setError(t("visitorCheckin.leadTimeError"));
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
      form.append("scheduledFor", new Date(scheduledFor).toISOString());
      form.append("isEmergency", isEmergency ? "true" : "false");
      form.append("inductionAcknowledged", "true");
      form.append("popiaConsentAccepted", "true");
      form.append("indemnityAccepted", "true");
      if (documents) {
        Array.from(documents).forEach((file) => form.append("documents", file));
      }
      const res = await api.post(`/visitors/checkin/${siteId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDone({ id: res.data.id, scheduledFor: res.data.scheduledFor });
      const dataUrl = await QRCode.toDataURL(`visitor:${res.data.id}`, { width: 220, margin: 1 });
      setQrDataUrl(dataUrl);
    } catch {
      setError(t("visitorCheckin.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 p-4">
        <div className={`${cardClass} p-6 max-w-md text-center`}>{t("visitorCheckin.siteNotFound")}</div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 p-4">
        <div className={`${cardClass} p-6 sm:p-8 max-w-md text-center space-y-3`}>
          <h1 className="text-lg font-bold">{t("visitorCheckin.successTitle")}</h1>
          <p className="text-mine-300 text-sm">
            {t("visitorCheckin.successBody", { time: new Date(done.scheduledFor).toLocaleString() })}
          </p>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <img src={qrDataUrl} alt="Your check-in QR code" className="rounded-md border border-mine-800" />
              <p className="text-xs text-mine-400 max-w-xs">{t("visitorCheckin.qrHint")}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mine-950 flex items-center justify-center p-4">
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
            <FileDropzone multiple accept="image/*,.pdf" hint={t("visitorCheckin.documentsHint")} onFiles={setDocuments} />
          </div>

          <div className="space-y-2 border border-mine-800 rounded-md p-3 bg-mine-900/40">
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={isEmergency}
                onChange={(e) => setIsEmergency(e.target.checked)}
              />
              <span>{t("visitorCheckin.emergencyDeclaration")}</span>
            </label>
            {!isEmergency && (
              <div>
                <label className={labelClass}>{t("visitorCheckin.scheduledFor")}</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  required={!isEmergency}
                />
                <p className="text-xs text-mine-400 mt-1">{t("visitorCheckin.scheduledForHint")}</p>
              </div>
            )}
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
