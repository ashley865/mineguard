import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import { CyberNetworkAsset, CyberNetworkAssetStatus, CyberNetworkAssetType } from "../../api/types";
import { CyberTheme, StatusPill, cyberButtonDanger, cyberButtonPrimary, cyberButtonSecondary } from "./cyberTheme";
import CyberTable, { CyberTableColumn } from "./CyberTable";
import CyberModal from "./CyberModal";

const assetTypes: CyberNetworkAssetType[] = ["FIREWALL", "VPN_GATEWAY", "ROUTER_SWITCH", "IDS_IPS", "ROGUE_DEVICE", "OPEN_PORT", "SUSPICIOUS_CONNECTION"];
const assetStatuses: CyberNetworkAssetStatus[] = ["SECURE", "WARNING", "COMPROMISED", "UNKNOWN"];

function NetworkAssetForm({ theme, initial, onSubmit, onCancel }: { theme: CyberTheme; initial?: CyberNetworkAsset; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [assetType, setAssetType] = useState<CyberNetworkAssetType>(initial?.assetType ?? "FIREWALL");
  const [name, setName] = useState(initial?.name ?? "");
  const [ipAddress, setIpAddress] = useState(initial?.ipAddress ?? "");
  const [status, setStatus] = useState<CyberNetworkAssetStatus>(initial?.status ?? "UNKNOWN");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const label = `block text-xs font-semibold mb-1 ${theme.subtext}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ assetType, name, ipAddress: ipAddress || undefined, status, description: description || undefined, notes: notes || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.network.assetType")}</label>
          <select className={theme.select} value={assetType} onChange={(e) => setAssetType(e.target.value as CyberNetworkAssetType)}>
            {assetTypes.map((a) => <option key={a} value={a}>{t(`cyber.network.assetTypes.${a}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.network.name")}</label>
          <input className={theme.input} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.network.ipAddress")}</label>
          <input className={theme.input} value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
        </div>
        <div>
          <label className={label}>{t("common.status")}</label>
          <select className={theme.select} value={status} onChange={(e) => setStatus(e.target.value as CyberNetworkAssetStatus)}>
            {assetStatuses.map((s) => <option key={s} value={s}>{t(`cyber.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={label}>{t("common.description")}</label>
        <textarea className={theme.input} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
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

export default function NetworkTab({ theme, canEdit, canDelete }: { theme: CyberTheme; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<CyberNetworkAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | CyberNetworkAsset>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<CyberNetworkAsset[]>("/cyber-network");
      setAssets(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/cyber-network", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/cyber-network/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("cyber.network.confirmDelete"))) return;
    await api.delete(`/cyber-network/${id}`);
    await load();
  }

  if (loading) return <div className={theme.subtext}>{t("common.loading")}</div>;

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <button className={cyberButtonPrimary} onClick={() => setModal("create")}>{t("cyber.network.new")}</button>
        </div>
      )}
      <CyberTable
        theme={theme}
        columns={
          [
            { key: "type", header: t("cyber.network.assetType"), render: (a) => t(`cyber.network.assetTypes.${a.assetType}`), sortValue: (a) => a.assetType },
            { key: "name", header: t("cyber.network.name"), render: (a) => <span className={theme.text}>{a.name}</span>, sortValue: (a) => a.name },
            { key: "ip", header: t("cyber.network.ipAddress"), render: (a) => a.ipAddress ?? "—" },
            { key: "status", header: t("common.status"), render: (a) => <StatusPill status={a.status} /> },
            { key: "detected", header: t("cyber.network.detectedAt"), render: (a) => new Date(a.detectedAt).toLocaleDateString(), sortValue: (a) => a.detectedAt },
          ] as CyberTableColumn<CyberNetworkAsset>[]
        }
        rows={assets}
        rowKey={(a) => a.id}
        emptyMessage={t("cyber.network.noneYet")}
        searchValue={(a) => `${a.name} ${a.ipAddress ?? ""}`}
        actions={(a) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="CyberNetworkAsset" entityId={a.id} />
            {canEdit && <button className={cyberButtonSecondary(theme)} onClick={() => setModal(a)}>{t("common.edit")}</button>}
            {canDelete && <button className={cyberButtonDanger} onClick={() => remove(a.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <CyberModal theme={theme} title={modal === "create" ? t("cyber.network.newTitle") : t("cyber.network.editTitle")} onClose={() => setModal(null)}>
          <NetworkAssetForm theme={theme} initial={modal === "create" ? undefined : modal} onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))} onCancel={() => setModal(null)} />
        </CyberModal>
      )}
    </div>
  );
}
