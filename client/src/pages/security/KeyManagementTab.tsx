import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { KeyIssueLog, SecurityKey, Site, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import LoadError from "../../components/LoadError";

function KeyForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [keyCode, setKeyCode] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ siteId, keyCode, description, location: location || null });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("keyManagement.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("keyManagement.keyCode")}</label>
          <input className={inputClass} value={keyCode} onChange={(e) => setKeyCode(e.target.value)} required autoFocus />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("keyManagement.location")}</label>
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("keyManagement.locationPlaceholder") ?? ""} />
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function IssueForm({ workers, onSubmit, onCancel }: {
  workers: Worker[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"worker" | "external">("worker");
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [holderName, setHolderName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(
        mode === "worker"
          ? { workerId, notes: notes || undefined }
          : { holderName, notes: notes || undefined }
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <button type="button" className={mode === "worker" ? buttonPrimary : buttonSecondary} onClick={() => setMode("worker")}>{t("keyManagement.holderWorker")}</button>
        <button type="button" className={mode === "external" ? buttonPrimary : buttonSecondary} onClick={() => setMode("external")}>{t("keyManagement.holderExternal")}</button>
      </div>
      {mode === "worker" ? (
        <div>
          <label className={labelClass}>{t("keyManagement.selectWorker")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.employeeId})</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label className={labelClass}>{t("keyManagement.holderName")}</label>
          <input className={inputClass} value={holderName} onChange={(e) => setHolderName(e.target.value)} required autoFocus placeholder={t("keyManagement.holderNamePlaceholder") ?? ""} />
        </div>
      )}
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("keyManagement.issue")}</button>
      </div>
    </form>
  );
}

function LogModal({ securityKey, onClose }: { securityKey: SecurityKey; onClose: () => void }) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<KeyIssueLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    api
      .get<KeyIssueLog[]>(`/key-management/${securityKey.id}/logs`)
      .then((res) => setLogs(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [securityKey.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title={t("keyManagement.historyTitle", { code: securityKey.keyCode })} onClose={onClose}>
      {loading ? (
        <div className="text-mine-300 text-sm">{t("common.loading")}</div>
      ) : loadError ? (
        <LoadError onRetry={load} />
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className={`${cardClass} p-3`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t(`keyManagement.events.${l.eventType}`)}</span>
                <span className="text-[10px] text-mine-400">{new Date(l.eventAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-mine-300 mt-1">{l.worker?.name ?? l.holderName ?? "—"}</p>
              {l.notes && <p className="text-xs text-mine-400 mt-1">{l.notes}</p>}
              <p className="text-[10px] text-mine-500 mt-1">{t("keyManagement.colLoggedBy")}: {l.loggedBy?.name ?? "—"}</p>
            </div>
          ))}
          {logs.length === 0 && <p className="text-xs text-mine-400">{t("keyManagement.noHistory")}</p>}
        </div>
      )}
    </Modal>
  );
}

export default function KeyManagementTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [keys, setKeys] = useState<SecurityKey[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [issueModal, setIssueModal] = useState<SecurityKey | null>(null);
  const [historyModal, setHistoryModal] = useState<SecurityKey | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [k, w] = await Promise.all([
        api.get<SecurityKey[]>("/key-management"),
        api.get<Worker[]>("/workers"),
      ]);
      setKeys(k.data);
      setWorkers(w.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/key-management", data);
    setCreateModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("keyManagement.confirmDelete"))) return;
    await api.delete(`/key-management/${id}`);
    await load();
  }

  async function issue(data: any) {
    if (!issueModal) return;
    await api.post(`/key-management/${issueModal.id}/issue`, data);
    setIssueModal(null);
    await load();
  }

  async function returnKey(key: SecurityKey) {
    if (!confirm(t("keyManagement.confirmReturn"))) return;
    await api.post(`/key-management/${key.id}/return`, {});
    await load();
  }

  async function reportLost(key: SecurityKey) {
    if (!confirm(t("keyManagement.confirmReportLost"))) return;
    await api.post(`/key-management/${key.id}/report-lost`, {});
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const availableCount = keys.filter((k) => k.status === "AVAILABLE").length;
  const issuedCount = keys.filter((k) => k.status === "ISSUED").length;
  const lostCount = keys.filter((k) => k.status === "LOST").length;

  const columns: DataTableColumn<SecurityKey>[] = [
    { key: "keyCode", header: t("keyManagement.keyCode"), render: (k) => <span className="font-medium">{k.keyCode}</span>, sortValue: (k) => k.keyCode },
    { key: "description", header: t("common.description"), render: (k) => <>{k.description}<div className="text-[10px] text-mine-400">{k.site?.name}{k.location ? ` · ${k.location}` : ""}</div></> },
    { key: "holder", header: t("keyManagement.currentHolder"), render: (k) => k.currentWorker?.name ?? k.currentHolderName ?? "—" },
    { key: "status", header: t("common.status"), render: (k) => <StatusBadge status={k.status} />, sortValue: (k) => k.status },
  ];

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("keyManagement.subtitle")}</p>

      <SummaryCards
        cards={[
          { label: t("keyManagement.summaryAvailable"), value: availableCount },
          { label: t("keyManagement.summaryIssued"), value: issuedCount, tone: issuedCount > 0 ? "hazard" : "default" },
          { label: t("keyManagement.summaryLost"), value: lostCount, tone: lostCount > 0 ? "danger" : "default" },
        ]}
      />

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setCreateModal(true)}>{t("keyManagement.newKey")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={keys}
        rowKey={(k) => k.id}
        emptyMessage={t("keyManagement.noneYet")}
        searchValue={(k) => `${k.keyCode} ${k.description}`}
        actions={(k) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="SecurityKey" entityId={k.id} />
            <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryModal(k)}>{t("keyManagement.history")}</button>
            {canEdit && (
              <>
                {k.status === "AVAILABLE" && (
                  <button className="text-xs text-hazard-500 hover:text-hazard-400" onClick={() => setIssueModal(k)}>{t("keyManagement.issue")}</button>
                )}
                {k.status === "ISSUED" && (
                  <>
                    <button className="text-xs text-success-500 hover:text-success-400" onClick={() => returnKey(k)}>{t("keyManagement.return")}</button>
                    <button className="text-xs text-danger-500 hover:text-danger-400" onClick={() => reportLost(k)}>{t("keyManagement.reportLost")}</button>
                  </>
                )}
                <button className={buttonDanger} onClick={() => remove(k.id)}>{t("common.delete")}</button>
              </>
            )}
          </div>
        )}
      />

      {createModal && (
        <Modal title={t("keyManagement.newKeyTitle")} onClose={() => setCreateModal(false)}>
          <KeyForm sites={sites} onSubmit={create} onCancel={() => setCreateModal(false)} />
        </Modal>
      )}

      {issueModal && (
        <Modal title={t("keyManagement.issueTitle", { code: issueModal.keyCode })} onClose={() => setIssueModal(null)}>
          <IssueForm workers={workers} onSubmit={issue} onCancel={() => setIssueModal(null)} />
        </Modal>
      )}

      {historyModal && <LogModal securityKey={historyModal} onClose={() => setHistoryModal(null)} />}
    </div>
  );
}
