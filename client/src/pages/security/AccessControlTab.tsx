import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { GateLog, GatePass, GatePassType, SecurityBlacklistEntry, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import DateField from "../../components/DateField";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";

type SubTab = "passes" | "log" | "blacklist";

const passTypes: GatePassType[] = ["VISITOR", "CONTRACTOR", "EMPLOYEE_VEHICLE", "DELIVERY_VEHICLE", "EQUIPMENT_REMOVAL", "OTHER"];

function GatePassForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: Partial<GatePass>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [type, setType] = useState<GatePassType>(initial?.type ?? "VISITOR");
  const [holderName, setHolderName] = useState(initial?.holderName ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [idNumber, setIdNumber] = useState(initial?.idNumber ?? "");
  const [vehicleReg, setVehicleReg] = useState(initial?.vehicleReg ?? "");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [validTo, setValidTo] = useState(initial?.validTo?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId, type, holderName,
        company: company || null,
        idNumber: idNumber || null,
        vehicleReg: vehicleReg || null,
        purpose: purpose || null,
        validTo: validTo || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("accessControl.passType")}</label>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as GatePassType)}>
            {passTypes.map((p) => <option key={p} value={p}>{t(`accessControl.passTypes.${p}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("accessControl.holderName")}</label>
        <input className={inputClass} value={holderName} onChange={(e) => setHolderName(e.target.value)} required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("accessControl.company")}</label>
          <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("accessControl.idNumber")}</label>
          <input className={inputClass} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("accessControl.vehicleReg")}</label>
          <input className={inputClass} value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("accessControl.validTo")}</label>
          <DateField value={validTo} onChange={setValidTo} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("accessControl.purpose")}</label>
        <textarea className={inputClass} rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function GateLogForm({ sites, passes, onSubmit, onCancel }: {
  sites: Site[];
  passes: GatePass[];
  onSubmit: (data: any) => Promise<{ blacklistWarning: { name: string; reason: string } | null }>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [personName, setPersonName] = useState("");
  const [company, setCompany] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [itemsCarried, setItemsCarried] = useState("");
  const [gateName, setGateName] = useState("");
  const [gatePassId, setGatePassId] = useState("");
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<{ name: string; reason: string } | null>(null);

  const passesForSite = passes.filter((p) => p.siteId === siteId && p.status === "ACTIVE");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await onSubmit({
        siteId, direction, personName,
        company: company || null,
        vehicleReg: vehicleReg || null,
        itemsCarried: itemsCarried || null,
        gateName: gateName || null,
        gatePassId: gatePassId || null,
      });
      if (res.blacklistWarning) {
        setWarning(res.blacklistWarning);
      } else {
        onCancel();
      }
    } finally {
      setSaving(false);
    }
  }

  if (warning) {
    return (
      <div className="space-y-4">
        <div className="bg-danger-500/10 border border-danger-500 rounded p-3 text-sm text-danger-500">
          <p className="font-semibold">{t("accessControl.blacklistWarningTitle", { name: warning.name })}</p>
          <p className="mt-1">{warning.reason}</p>
        </div>
        <div className="flex justify-end pt-2">
          <button className={buttonPrimary} onClick={onCancel}>{t("common.close")}</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setGatePassId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("accessControl.direction")}</label>
          <select className={selectClass} value={direction} onChange={(e) => setDirection(e.target.value as "IN" | "OUT")}>
            <option value="IN">{t("accessControl.directions.IN")}</option>
            <option value="OUT">{t("accessControl.directions.OUT")}</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("accessControl.holderName")}</label>
        <input className={inputClass} value={personName} onChange={(e) => setPersonName(e.target.value)} required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("accessControl.company")}</label>
          <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("accessControl.vehicleReg")}</label>
          <input className={inputClass} value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("accessControl.gateName")}</label>
          <input className={inputClass} value={gateName} onChange={(e) => setGateName(e.target.value)} placeholder={t("accessControl.gateNamePlaceholder") ?? ""} />
        </div>
        <div>
          <label className={labelClass}>{t("accessControl.linkedPass")}</label>
          <select className={selectClass} value={gatePassId} onChange={(e) => setGatePassId(e.target.value)}>
            <option value="">{t("common.none")}</option>
            {passesForSite.map((p) => <option key={p.id} value={p.id}>{p.holderName}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("accessControl.itemsCarried")}</label>
        <textarea className={inputClass} rows={2} value={itemsCarried} onChange={(e) => setItemsCarried(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("accessControl.logEntry")}</button>
      </div>
    </form>
  );
}

function BlacklistForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: Partial<SecurityBlacklistEntry>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [idNumber, setIdNumber] = useState(initial?.idNumber ?? "");
  const [vehicleReg, setVehicleReg] = useState(initial?.vehicleReg ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId: siteId || null, name, idNumber: idNumber || null, vehicleReg: vehicleReg || null, reason });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("accessControl.blacklistScope")}</label>
        <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{t("accessControl.allSites")}</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("accessControl.holderName")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("accessControl.idNumber")}</label>
          <input className={inputClass} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("accessControl.vehicleReg")}</label>
          <input className={inputClass} value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("accessControl.blacklistReason")}</label>
        <textarea className={inputClass} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function AccessControlTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [subTab, setSubTab] = useState<SubTab>("passes");
  const [passes, setPasses] = useState<GatePass[]>([]);
  const [logs, setLogs] = useState<GateLog[]>([]);
  const [blacklist, setBlacklist] = useState<SecurityBlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [passModal, setPassModal] = useState<null | "create" | GatePass>(null);
  const [logModal, setLogModal] = useState(false);
  const [blacklistModal, setBlacklistModal] = useState<null | "create" | SecurityBlacklistEntry>(null);

  async function load() {
    setLoading(true);
    const [p, l, b] = await Promise.allSettled([
      api.get<GatePass[]>("/access-control/passes"),
      api.get<GateLog[]>("/access-control/logs"),
      api.get<SecurityBlacklistEntry[]>("/access-control/blacklist"),
    ]);
    if (p.status === "fulfilled") setPasses(p.value.data);
    if (l.status === "fulfilled") setLogs(l.value.data);
    if (b.status === "fulfilled") setBlacklist(b.value.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createPass(data: any) {
    await api.post("/access-control/passes", data);
    setPassModal(null);
    await load();
  }

  async function updatePass(id: string, data: any) {
    await api.put(`/access-control/passes/${id}`, data);
    setPassModal(null);
    await load();
  }

  async function revokePass(pass: GatePass) {
    const reason = prompt(t("accessControl.revokeReasonPrompt") ?? "");
    if (reason === null) return;
    await api.put(`/access-control/passes/${pass.id}`, { status: "REVOKED", revokedReason: reason || null });
    await load();
  }

  async function removePass(id: string) {
    if (!confirm(t("accessControl.confirmDeletePass"))) return;
    await api.delete(`/access-control/passes/${id}`);
    await load();
  }

  async function createLog(data: any) {
    const res = await api.post("/access-control/logs", data);
    await load();
    return { blacklistWarning: res.data.blacklistWarning };
  }

  async function createBlacklist(data: any) {
    await api.post("/access-control/blacklist", data);
    setBlacklistModal(null);
    await load();
  }

  async function updateBlacklist(id: string, data: any) {
    await api.put(`/access-control/blacklist/${id}`, data);
    setBlacklistModal(null);
    await load();
  }

  async function removeBlacklist(id: string) {
    if (!confirm(t("accessControl.confirmDeleteBlacklist"))) return;
    await api.delete(`/access-control/blacklist/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  const activePassCount = passes.filter((p) => p.status === "ACTIVE").length;
  const activeBlacklistCount = blacklist.filter((b) => b.isActive).length;
  const todayLogCount = logs.filter((l) => new Date(l.loggedAt).toDateString() === new Date().toDateString()).length;

  const passColumns: DataTableColumn<GatePass>[] = [
    { key: "holder", header: t("accessControl.holderName"), render: (p) => <span className="font-medium">{p.holderName}</span>, sortValue: (p) => p.holderName },
    { key: "type", header: t("accessControl.passType"), render: (p) => t(`accessControl.passTypes.${p.type}`), sortValue: (p) => p.type },
    { key: "site", header: t("common.site"), render: (p) => p.site?.name ?? "—", sortValue: (p) => p.site?.name ?? "" },
    { key: "vehicleReg", header: t("accessControl.vehicleReg"), render: (p) => p.vehicleReg ?? "—" },
    { key: "validTo", header: t("accessControl.validTo"), render: (p) => (p.validTo ? new Date(p.validTo).toLocaleDateString() : "—") },
    { key: "status", header: t("common.status"), render: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status },
  ];

  const logColumns: DataTableColumn<GateLog>[] = [
    { key: "loggedAt", header: t("accessControl.colTime"), render: (l) => new Date(l.loggedAt).toLocaleString(), sortValue: (l) => l.loggedAt },
    { key: "direction", header: t("accessControl.direction"), render: (l) => t(`accessControl.directions.${l.direction}`), sortValue: (l) => l.direction },
    { key: "person", header: t("accessControl.holderName"), render: (l) => <>{l.personName}<div className="text-[10px] text-mine-400">{l.site?.name}{l.gateName ? ` · ${l.gateName}` : ""}</div></> },
    { key: "vehicleReg", header: t("accessControl.vehicleReg"), render: (l) => l.vehicleReg ?? "—" },
    { key: "loggedBy", header: t("accessControl.colLoggedBy"), render: (l) => l.loggedBy?.name ?? "—" },
  ];

  const blacklistColumns: DataTableColumn<SecurityBlacklistEntry>[] = [
    { key: "name", header: t("accessControl.holderName"), render: (b) => <span className="font-medium">{b.name}</span>, sortValue: (b) => b.name },
    { key: "scope", header: t("accessControl.blacklistScope"), render: (b) => b.site?.name ?? t("accessControl.allSites") },
    { key: "vehicleReg", header: t("accessControl.vehicleReg"), render: (b) => b.vehicleReg ?? "—" },
    { key: "reason", header: t("accessControl.blacklistReason"), render: (b) => <div className="truncate max-w-xs" title={b.reason}>{b.reason}</div> },
    { key: "status", header: t("common.status"), render: (b) => <StatusBadge status={b.isActive ? "ACTIVE" : "INACTIVE"} /> },
  ];

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("accessControl.subtitle")}</p>

      <SummaryCards
        cards={[
          { label: t("accessControl.summaryActivePasses"), value: activePassCount },
          { label: t("accessControl.summaryTodayMovements"), value: todayLogCount },
          { label: t("accessControl.summaryBlacklisted"), value: activeBlacklistCount, tone: activeBlacklistCount > 0 ? "danger" : "default" },
        ]}
      />

      <div className="flex gap-2 flex-wrap">
        <button className={subTab === "passes" ? buttonPrimary : buttonSecondary} onClick={() => setSubTab("passes")}>{t("accessControl.tabPasses")}</button>
        <button className={subTab === "log" ? buttonPrimary : buttonSecondary} onClick={() => setSubTab("log")}>{t("accessControl.tabLog")}</button>
        <button className={subTab === "blacklist" ? buttonPrimary : buttonSecondary} onClick={() => setSubTab("blacklist")}>{t("accessControl.tabBlacklist")}</button>
      </div>

      {subTab === "passes" && (
        <div className="space-y-3">
          {canEdit && sites.length > 0 && (
            <div className="flex justify-end">
              <button className={buttonPrimary} onClick={() => setPassModal("create")}>{t("accessControl.newPass")}</button>
            </div>
          )}
          <DataTable
            columns={passColumns}
            rows={passes}
            rowKey={(p) => p.id}
            emptyMessage={t("accessControl.noPasses")}
            searchValue={(p) => `${p.holderName} ${p.company ?? ""} ${p.vehicleReg ?? ""}`}
            actions={(p) => (
              <div className="flex justify-end gap-2">
                <AuditHistoryButton entityType="GatePass" entityId={p.id} />
                {canEdit && (
                  <>
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setPassModal(p)}>{t("common.edit")}</button>
                    {p.status === "ACTIVE" && (
                      <button className="text-xs text-hazard-500 hover:text-hazard-400" onClick={() => revokePass(p)}>{t("accessControl.revoke")}</button>
                    )}
                    <button className={buttonDanger} onClick={() => removePass(p.id)}>{t("common.delete")}</button>
                  </>
                )}
              </div>
            )}
          />
        </div>
      )}

      {subTab === "log" && (
        <div className="space-y-3">
          {canEdit && sites.length > 0 && (
            <div className="flex justify-end">
              <button className={buttonPrimary} onClick={() => setLogModal(true)}>{t("accessControl.newLogEntry")}</button>
            </div>
          )}
          <DataTable
            columns={logColumns}
            rows={logs}
            rowKey={(l) => l.id}
            emptyMessage={t("accessControl.noLogs")}
            searchValue={(l) => `${l.personName} ${l.company ?? ""} ${l.vehicleReg ?? ""}`}
            exportFilename="gate-log"
            exportColumns={[
              { header: t("accessControl.colTime"), value: (l) => l.loggedAt },
              { header: t("accessControl.direction"), value: (l) => l.direction },
              { header: t("accessControl.holderName"), value: (l) => l.personName },
              { header: t("accessControl.vehicleReg"), value: (l) => l.vehicleReg ?? "" },
            ]}
          />
        </div>
      )}

      {subTab === "blacklist" && (
        <div className="space-y-3">
          <p className="text-xs text-mine-400">{t("accessControl.blacklistHint")}</p>
          {canEdit && (
            <div className="flex justify-end">
              <button className={buttonPrimary} onClick={() => setBlacklistModal("create")}>{t("accessControl.newBlacklistEntry")}</button>
            </div>
          )}
          <DataTable
            columns={blacklistColumns}
            rows={blacklist}
            rowKey={(b) => b.id}
            emptyMessage={t("accessControl.noBlacklistEntries")}
            searchValue={(b) => `${b.name} ${b.vehicleReg ?? ""}`}
            actions={(b) => canEdit && (
              <div className="flex justify-end gap-2">
                <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setBlacklistModal(b)}>{t("common.edit")}</button>
                <button className={buttonDanger} onClick={() => removeBlacklist(b.id)}>{t("common.delete")}</button>
              </div>
            )}
          />
        </div>
      )}

      {passModal && (
        <Modal title={passModal === "create" ? t("accessControl.newPassTitle") : t("accessControl.editPassTitle")} onClose={() => setPassModal(null)} size="lg">
          <GatePassForm
            sites={sites}
            initial={passModal === "create" ? undefined : passModal}
            onSubmit={(data) => (passModal === "create" ? createPass(data) : updatePass(passModal.id, data))}
            onCancel={() => setPassModal(null)}
          />
        </Modal>
      )}

      {logModal && (
        <Modal title={t("accessControl.newLogEntryTitle")} onClose={() => setLogModal(false)} size="lg">
          <GateLogForm sites={sites} passes={passes} onSubmit={createLog} onCancel={() => setLogModal(false)} />
        </Modal>
      )}

      {blacklistModal && (
        <Modal title={blacklistModal === "create" ? t("accessControl.newBlacklistEntryTitle") : t("accessControl.editBlacklistEntryTitle")} onClose={() => setBlacklistModal(null)}>
          <BlacklistForm
            sites={sites}
            initial={blacklistModal === "create" ? undefined : blacklistModal}
            onSubmit={(data) => (blacklistModal === "create" ? createBlacklist(data) : updateBlacklist(blacklistModal.id, data))}
            onCancel={() => setBlacklistModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
