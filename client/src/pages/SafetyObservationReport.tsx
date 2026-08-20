import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { SafetyObservationType } from "../api/types";
import { buttonPrimary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { LogoMark, Wordmark } from "../components/Logo";

const types: SafetyObservationType[] = ["NEAR_MISS", "UNSAFE_ACT", "UNSAFE_CONDITION", "POSITIVE_OBSERVATION"];

export default function SafetyObservationReport() {
  const { t } = useTranslation();
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<{ id: string; name: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [type, setType] = useState<SafetyObservationType>("NEAR_MISS");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [reporterName, setReporterName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    api.get(`/safety-observations/site/${siteId}/info`).then((res) => setSite(res.data)).catch(() => setNotFound(true));
  }, [siteId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/safety-observations/report/${siteId}`, {
        type,
        description,
        location: location || undefined,
        reporterName: reporterName || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("safetyObservations.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 p-4">
        <div className={`${cardClass} p-6 sm:p-8 max-w-md text-center`}>
          <p className="text-mine-300 text-sm">{t("safetyObservations.siteNotFound")}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 p-4">
        <div className={`${cardClass} p-6 sm:p-8 max-w-md text-center space-y-3`}>
          <h1 className="text-lg font-bold">{t("safetyObservations.successTitle")}</h1>
          <p className="text-mine-300 text-sm">{t("safetyObservations.successBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mine-950 flex items-center justify-center p-4 py-8">
      <div className={`${cardClass} p-6 w-full max-w-lg space-y-5`}>
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div>
          <div className="text-lg font-bold tracking-tight flex items-center gap-2"><LogoMark size={20} /><Wordmark /></div>
          <h1 className="text-base font-semibold mt-2">{t("safetyObservations.reportTitle")}</h1>
          {site && <p className="text-mine-300 text-sm">{t("safetyObservations.reportSubtitle", { site: site.name })}</p>}
        </div>

        <p className="text-xs text-mine-400 bg-mine-800/40 border border-mine-800 rounded-md p-3">
          {t("safetyObservations.anonymousNote")}
        </p>

        {error && <div className="text-danger-500 text-sm bg-danger-500/10 border border-danger-500/30 rounded-md px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>{t("safetyObservations.type")}</label>
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as SafetyObservationType)}>
              {types.map((ty) => <option key={ty} value={ty}>{t(`safetyObservations.types.${ty}`)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("common.description")}</label>
            <textarea className={inputClass} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t("safetyObservations.location")}</label>
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("safetyObservations.reporterNameOptional")}</label>
            <input className={inputClass} value={reporterName} onChange={(e) => setReporterName(e.target.value)} />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`} disabled={submitting}>
            {submitting ? t("common.saving") : t("safetyObservations.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
