import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { MineralRight, MineralRightStatus, MineralRightType, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import DueDate, { isOverdue } from "./DueDate";
import StatTile from "../plant/StatTile";

const rightTypes: MineralRightType[] = ["PROSPECTING_RIGHT", "MINING_RIGHT", "MINING_PERMIT", "RECONNAISSANCE_PERMIT", "RETENTION_PERMIT"];
const rightStatuses: MineralRightStatus[] = ["ACTIVE", "RENEWAL_PENDING", "EXPIRED", "RELINQUISHED"];

function RightForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: MineralRight;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? "");
  const [rightType, setRightType] = useState<MineralRightType>(initial?.rightType ?? "MINING_RIGHT");
  const [rightReferenceNumber, setRightReferenceNumber] = useState(initial?.rightReferenceNumber ?? "");
  const [mineralsScheduled, setMineralsScheduled] = useState(initial?.mineralsScheduled ?? "");
  const [areaHectares, setAreaHectares] = useState(initial?.areaHectares?.toString() ?? "");
  const [holderName, setHolderName] = useState(initial?.holderName ?? "");
  const [grantedDate, setGrantedDate] = useState(initial?.grantedDate?.slice(0, 10) ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate?.slice(0, 10) ?? "");
  const [renewalApplicationDue, setRenewalApplicationDue] = useState(initial?.renewalApplicationDue?.slice(0, 10) ?? "");
  const [renewalLodgedDate, setRenewalLodgedDate] = useState(initial?.renewalLodgedDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<MineralRightStatus>(initial?.status ?? "ACTIVE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId: siteId || null,
        rightType,
        rightReferenceNumber,
        mineralsScheduled: mineralsScheduled || undefined,
        areaHectares: areaHectares ? Number(areaHectares) : null,
        holderName: holderName || undefined,
        grantedDate: grantedDate || null,
        expiryDate: expiryDate || null,
        renewalApplicationDue: renewalApplicationDue || null,
        renewalLodgedDate: renewalLodgedDate || null,
        status,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.rights.rightReferenceNumber")}</label>
          <input className={inputClass} value={rightReferenceNumber} onChange={(e) => setRightReferenceNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.rights.rightType")}</label>
          <select className={selectClass} value={rightType} onChange={(e) => setRightType(e.target.value as MineralRightType)}>
            {rightTypes.map((rt) => <option key={rt} value={rt}>{t(`resourceGovernance.rights.types.${rt}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.site")}</label>
        <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{t("resourceGovernance.rights.mineWide")}</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.rights.mineralsScheduled")}</label>
          <input className={inputClass} value={mineralsScheduled} onChange={(e) => setMineralsScheduled(e.target.value)} placeholder="Gold, Silver" />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.rights.areaHectares")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={areaHectares} onChange={(e) => setAreaHectares(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("resourceGovernance.rights.holderName")}</label>
        <input className={inputClass} value={holderName} onChange={(e) => setHolderName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.rights.grantedDate")}</label>
          <DateField value={grantedDate} onChange={setGrantedDate} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.rights.expiryDate")}</label>
          <DateField value={expiryDate} onChange={setExpiryDate} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.rights.renewalApplicationDue")}</label>
          <DateField value={renewalApplicationDue} onChange={setRenewalApplicationDue} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.rights.renewalLodgedDate")}</label>
          <DateField value={renewalLodgedDate} onChange={setRenewalLodgedDate} />
        </div>
      </div>
      {renewalApplicationDue && !renewalLodgedDate && isOverdue(renewalApplicationDue) && (
        <p className="text-xs text-danger-500">{t("resourceGovernance.rights.renewalOverdueWarning")}</p>
      )}
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as MineralRightStatus)}>
          {rightStatuses.map((s) => <option key={s} value={s}>{t(`resourceGovernance.rights.statuses.${s}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function MineralRightsTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [rights, setRights] = useState<MineralRight[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | MineralRight>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<MineralRight[]>("/mineral-rights");
      setRights(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = rights.filter((r) => r.status === "ACTIVE" || r.status === "RENEWAL_PENDING");
    const expiringWithNoLodgement = active.filter((r) => r.renewalApplicationDue && !r.renewalLodgedDate && isOverdue(r.renewalApplicationDue));
    const expiredStillListedActive = rights.filter((r) => r.status === "ACTIVE" && isOverdue(r.expiryDate));
    return { active: active.length, expiringWithNoLodgement: expiringWithNoLodgement.length, expiredStillListedActive: expiredStillListedActive.length };
  }, [rights]);

  async function create(data: any) {
    await api.post("/mineral-rights", data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/mineral-rights/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("resourceGovernance.rights.confirmDelete"))) return;
    await api.delete(`/mineral-rights/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<MineralRight>[] = [
    { key: "rightReferenceNumber", header: t("resourceGovernance.rights.rightReferenceNumber"), render: (r) => r.rightReferenceNumber, sortValue: (r) => r.rightReferenceNumber },
    { key: "rightType", header: t("resourceGovernance.rights.rightType"), render: (r) => t(`resourceGovernance.rights.types.${r.rightType}`), sortValue: (r) => r.rightType },
    { key: "site", header: t("common.site"), render: (r) => r.site?.name ?? t("resourceGovernance.rights.mineWide"), sortValue: (r) => r.site?.name ?? "" },
    { key: "areaHectares", header: t("resourceGovernance.rights.areaHectares"), render: (r) => (r.areaHectares != null ? `${r.areaHectares.toLocaleString()} ha` : "—"), sortValue: (r) => r.areaHectares ?? -1 },
    { key: "expiryDate", header: t("resourceGovernance.rights.expiryDate"), render: (r) => <DueDate value={r.expiryDate} />, sortValue: (r) => r.expiryDate ?? "9999" },
    {
      key: "renewal",
      header: t("resourceGovernance.rights.renewalShort"),
      render: (r) =>
        !r.renewalApplicationDue ? (
          "—"
        ) : r.renewalLodgedDate ? (
          <span className="text-success-500">{t("resourceGovernance.rights.lodged")}</span>
        ) : (
          <DueDate value={r.renewalApplicationDue} />
        ),
      sortValue: (r) => r.renewalApplicationDue ?? "9999",
    },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} />, sortValue: (r) => r.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label={t("resourceGovernance.rights.statActive")} value={stats.active} target={t("resourceGovernance.rights.statActiveTarget")} />
        <StatTile
          label={t("resourceGovernance.rights.statRenewalOverdue")}
          value={stats.expiringWithNoLodgement}
          target={t("resourceGovernance.targetZero")}
          tone={stats.expiringWithNoLodgement === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("resourceGovernance.rights.statExpiredStillActive")}
          value={stats.expiredStillListedActive}
          target={t("resourceGovernance.targetZero")}
          tone={stats.expiredStillListedActive === 0 ? "good" : "bad"}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("resourceGovernance.rights.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("resourceGovernance.rights.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")}>{t("resourceGovernance.rights.newRight")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={rights}
          rowKey={(r) => r.id}
          emptyMessage={t("resourceGovernance.rights.noneYet")}
          searchValue={(r) => `${r.rightReferenceNumber} ${r.holderName ?? ""} ${r.mineralsScheduled ?? ""}`}
          exportFilename="mineral-rights"
          exportColumns={[
            { header: t("resourceGovernance.rights.rightReferenceNumber"), value: (r) => r.rightReferenceNumber },
            { header: t("resourceGovernance.rights.rightType"), value: (r) => r.rightType },
            { header: t("common.site"), value: (r) => r.site?.name ?? "" },
            { header: t("resourceGovernance.rights.expiryDate"), value: (r) => r.expiryDate?.slice(0, 10) ?? "" },
            { header: t("common.status"), value: (r) => r.status },
          ]}
          actions={(r) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(r)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("resourceGovernance.rights.newRightTitle") : t("resourceGovernance.rights.editRightTitle")} onClose={() => setFormModal(null)}>
          <RightForm
            sites={sites}
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(data) => (formModal === "create" ? create(data) : update(formModal.id, data))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
