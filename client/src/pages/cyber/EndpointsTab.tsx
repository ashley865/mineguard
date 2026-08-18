import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import {
  CyberEndpoint,
  CyberEndpointAvStatus,
  CyberEndpointDeviceType,
  CyberEndpointEncryptionStatus,
  CyberEndpointPatchStatus,
} from "../../api/types";
import { CyberTheme, StatusPill, cyberButtonDanger, cyberButtonPrimary, cyberButtonSecondary } from "./cyberTheme";
import CyberTable, { CyberTableColumn } from "./CyberTable";
import CyberModal from "./CyberModal";

const deviceTypes: CyberEndpointDeviceType[] = ["COMPUTER", "SERVER", "MOBILE", "IOT", "OT_EQUIPMENT"];
const avStatuses: CyberEndpointAvStatus[] = ["PROTECTED", "OUTDATED", "MISSING", "DISABLED"];
const patchStatuses: CyberEndpointPatchStatus[] = ["UP_TO_DATE", "PENDING", "OVERDUE", "UNKNOWN"];
const encryptionStatuses: CyberEndpointEncryptionStatus[] = ["ENCRYPTED", "NOT_ENCRYPTED", "UNKNOWN"];

function EndpointForm({ theme, initial, onSubmit, onCancel }: { theme: CyberTheme; initial?: CyberEndpoint; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [hostname, setHostname] = useState(initial?.hostname ?? "");
  const [deviceType, setDeviceType] = useState<CyberEndpointDeviceType>(initial?.deviceType ?? "COMPUTER");
  const [ownerName, setOwnerName] = useState(initial?.ownerName ?? "");
  const [operatingSystem, setOperatingSystem] = useState(initial?.operatingSystem ?? "");
  const [avEdrStatus, setAvEdrStatus] = useState<CyberEndpointAvStatus>(initial?.avEdrStatus ?? "MISSING");
  const [avEdrProduct, setAvEdrProduct] = useState(initial?.avEdrProduct ?? "");
  const [patchStatus, setPatchStatus] = useState<CyberEndpointPatchStatus>(initial?.patchStatus ?? "UNKNOWN");
  const [encryptionStatus, setEncryptionStatus] = useState<CyberEndpointEncryptionStatus>(initial?.encryptionStatus ?? "UNKNOWN");
  const [isCompromised, setIsCompromised] = useState(initial?.isCompromised ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const label = `block text-xs font-semibold mb-1 ${theme.subtext}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        hostname, deviceType, ownerName: ownerName || undefined, operatingSystem: operatingSystem || undefined,
        avEdrStatus, avEdrProduct: avEdrProduct || undefined, patchStatus, encryptionStatus, isCompromised,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.endpoints.hostname")}</label>
          <input className={theme.input} value={hostname} onChange={(e) => setHostname(e.target.value)} required />
        </div>
        <div>
          <label className={label}>{t("cyber.endpoints.deviceType")}</label>
          <select className={theme.select} value={deviceType} onChange={(e) => setDeviceType(e.target.value as CyberEndpointDeviceType)}>
            {deviceTypes.map((d) => <option key={d} value={d}>{t(`cyber.endpoints.deviceTypes.${d}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.endpoints.ownerName")}</label>
          <input className={theme.input} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>
        <div>
          <label className={label}>{t("cyber.endpoints.operatingSystem")}</label>
          <input className={theme.input} value={operatingSystem} onChange={(e) => setOperatingSystem(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.endpoints.avEdrStatus")}</label>
          <select className={theme.select} value={avEdrStatus} onChange={(e) => setAvEdrStatus(e.target.value as CyberEndpointAvStatus)}>
            {avStatuses.map((s) => <option key={s} value={s}>{t(`cyber.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.endpoints.avEdrProduct")}</label>
          <input className={theme.input} value={avEdrProduct} onChange={(e) => setAvEdrProduct(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.endpoints.patchStatus")}</label>
          <select className={theme.select} value={patchStatus} onChange={(e) => setPatchStatus(e.target.value as CyberEndpointPatchStatus)}>
            {patchStatuses.map((s) => <option key={s} value={s}>{t(`cyber.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.endpoints.encryptionStatus")}</label>
          <select className={theme.select} value={encryptionStatus} onChange={(e) => setEncryptionStatus(e.target.value as CyberEndpointEncryptionStatus)}>
            {encryptionStatuses.map((s) => <option key={s} value={s}>{t(`cyber.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <label className={`flex items-center gap-2 text-xs ${theme.text}`}>
        <input type="checkbox" checked={isCompromised} onChange={(e) => setIsCompromised(e.target.checked)} />
        {t("cyber.endpoints.isCompromised")}
      </label>
      <div>
        <label className={label}>{t("common.notes")}</label>
        <textarea className={theme.input} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={cyberButtonSecondary(theme)} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={cyberButtonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function EndpointsTab({ theme, canEdit, canDelete }: { theme: CyberTheme; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [endpoints, setEndpoints] = useState<CyberEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | CyberEndpoint>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<CyberEndpoint[]>("/cyber-endpoints");
      setEndpoints(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/cyber-endpoints", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/cyber-endpoints/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("cyber.endpoints.confirmDelete"))) return;
    await api.delete(`/cyber-endpoints/${id}`);
    await load();
  }

  if (loading) return <div className={theme.subtext}>{t("common.loading")}</div>;

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <button className={cyberButtonPrimary} onClick={() => setModal("create")}>{t("cyber.endpoints.new")}</button>
        </div>
      )}
      <CyberTable
        theme={theme}
        columns={
          [
            { key: "hostname", header: t("cyber.endpoints.hostname"), render: (e) => <span className={theme.text}>{e.hostname}</span>, sortValue: (e) => e.hostname },
            { key: "type", header: t("cyber.endpoints.deviceType"), render: (e) => t(`cyber.endpoints.deviceTypes.${e.deviceType}`) },
            { key: "owner", header: t("cyber.endpoints.ownerName"), render: (e) => e.ownerName ?? "—" },
            { key: "av", header: t("cyber.endpoints.avEdrStatus"), render: (e) => <StatusPill status={e.avEdrStatus} /> },
            { key: "patch", header: t("cyber.endpoints.patchStatus"), render: (e) => <StatusPill status={e.patchStatus} /> },
            { key: "encryption", header: t("cyber.endpoints.encryptionStatus"), render: (e) => <StatusPill status={e.encryptionStatus} /> },
            { key: "compromised", header: t("cyber.endpoints.isCompromised"), render: (e) => (e.isCompromised ? <StatusPill status="COMPROMISED" /> : "—") },
          ] as CyberTableColumn<CyberEndpoint>[]
        }
        rows={endpoints}
        rowKey={(e) => e.id}
        emptyMessage={t("cyber.endpoints.noneYet")}
        searchValue={(e) => `${e.hostname} ${e.ownerName ?? ""} ${e.operatingSystem ?? ""}`}
        actions={(e) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="CyberEndpoint" entityId={e.id} />
            {canEdit && <button className={cyberButtonSecondary(theme)} onClick={() => setModal(e)}>{t("common.edit")}</button>}
            {canDelete && <button className={cyberButtonDanger} onClick={() => remove(e.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <CyberModal theme={theme} title={modal === "create" ? t("cyber.endpoints.newTitle") : t("cyber.endpoints.editTitle")} onClose={() => setModal(null)}>
          <EndpointForm theme={theme} initial={modal === "create" ? undefined : modal} onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))} onCancel={() => setModal(null)} />
        </CyberModal>
      )}
    </div>
  );
}
