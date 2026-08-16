import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AlertSeverity, SafetyObservation, SafetyObservationStatus, SafetyObservationType, Site, Zone } from "../api/types";
import { StatusBadge, SeverityBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import LoadError from "../components/LoadError";

const types: SafetyObservationType[] = ["NEAR_MISS", "UNSAFE_ACT", "UNSAFE_CONDITION", "POSITIVE_OBSERVATION"];
const severities: AlertSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: SafetyObservationStatus[] = ["OPEN", "ACTION_REQUIRED", "CLOSED"];

function ShareModal({ sites, onClose }: { sites: Site[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = siteId ? `${window.location.origin}/safety-report/${siteId}` : "";

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 220, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal title={t("safetyObservations.shareTitle")} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {dataUrl && (
          <div className="flex flex-col items-center gap-2">
            <img src={dataUrl} alt="Safety observation QR code" className="rounded-md border border-mine-800" />
          </div>
        )}
        <div className="flex gap-2">
          <input readOnly className={`${inputClass} font-mono text-xs`} value={link} onFocus={(e) => e.target.select()} />
          <button type="button" className={buttonSecondary} onClick={copyLink}>
            {copied ? t("registerMine.copied") : t("registerMine.copy")}
          </button>
        </div>
        <p className="text-xs text-mine-400">{t("safetyObservations.shareHint")}</p>
      </div>
    </Modal>
  );
}

function ObservationForm({ sites, zones, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState("");
  const [type, setType] = useState<SafetyObservationType>("NEAR_MISS");
  const [severity, setSeverity] = useState<AlertSeverity>("LOW");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, zoneId: zoneId || null, type, severity, description, location: location || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("safetyObservations.type")}</label>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as SafetyObservationType)}>
            {types.map((ty) => <option key={ty} value={ty}>{t(`safetyObservations.types.${ty}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("incidents.severity")}</label>
          <select className={selectClass} value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)}>
            {severities.map((s) => <option key={s} value={s}>{t(`incidents.${s.toLowerCase()}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("safetyObservations.location")}</label>
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DetailModal({ observation, onClose, onChanged }: { observation: SafetyObservation; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SafetyObservationStatus>(observation.status);
  const [actionTaken, setActionTaken] = useState(observation.actionTaken ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.put(`/safety-observations/${observation.id}`, { status, actionTaken: actionTaken || undefined });
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t(`safetyObservations.types.${observation.type}`)} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2">
          <StatusBadge status={observation.status} />
          <SeverityBadge severity={observation.severity} />
        </div>
        <p className="text-mine-200">{observation.description}</p>
        <div className="text-xs text-mine-400 space-y-1">
          <div>{t("common.site")}: {observation.site?.name}{observation.zone?.name ? ` · ${observation.zone.name}` : ""}</div>
          {observation.location && <div>{t("safetyObservations.location")}: {observation.location}</div>}
          <div>{t("safetyObservations.reportedBy")}: {observation.reporterName || observation.reportedBy?.name || t("safetyObservations.anonymous")}</div>
          <div>{new Date(observation.createdAt).toLocaleString()}</div>
        </div>
        <div className="border-t border-mine-800 pt-3 space-y-2">
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as SafetyObservationStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
          <label className={labelClass}>{t("safetyObservations.actionTaken")}</label>
          <textarea className={inputClass} rows={2} value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} />
          <button className={buttonPrimary} disabled={saving} onClick={save}>{saving ? t("common.saving") : t("common.save")}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function SafetyObservations() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<SafetyObservation[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [selected, setSelected] = useState<SafetyObservation | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [i, s, z] = await Promise.all([
        api.get<SafetyObservation[]>("/safety-observations"),
        api.get<Site[]>("/sites"),
        api.get<Zone[]>("/zones"),
      ]);
      setItems(i.data);
      setSites(s.data);
      setZones(z.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/safety-observations", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("safetyObservations.confirmDelete"))) return;
    await api.delete(`/safety-observations/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("safetyObservations.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("safetyObservations.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {sites.length > 0 && (
            <button className={buttonSecondary} onClick={() => setShareModal(true)}>{t("safetyObservations.shareLink")}</button>
          )}
          {canEdit && sites.length > 0 && (
            <button className={buttonPrimary} onClick={() => setModal(true)}>{t("safetyObservations.newObservation")}</button>
          )}
        </div>
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("safetyObservations.type")}</th>
              <th className="text-left px-4 py-2">{t("incidents.severity")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t border-mine-800 hover:bg-mine-800/30 cursor-pointer" onClick={() => setSelected(o)}>
                <td className="px-4 py-2 font-medium">{t(`safetyObservations.types.${o.type}`)}</td>
                <td className="px-4 py-2"><SeverityBadge severity={o.severity} /></td>
                <td className="px-4 py-2 text-mine-300">{o.site?.name}</td>
                <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  {canDelete && (
                    <button className={buttonDanger} onClick={() => remove(o.id)}>{t("common.delete")}</button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("safetyObservations.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t("safetyObservations.newObservationTitle")} onClose={() => setModal(false)}>
          <ObservationForm sites={sites} zones={zones} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}

      {shareModal && <ShareModal sites={sites} onClose={() => setShareModal(false)} />}

      {selected && <DetailModal observation={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}
