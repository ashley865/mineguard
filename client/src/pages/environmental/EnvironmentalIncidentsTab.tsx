import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  EnvironmentalIncident,
  EnvironmentalIncidentCategory,
  EnvironmentalIncidentSeverity,
  EnvironmentalIncidentSummary,
  EnvironmentalRemediationStatus,
  Site,
} from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import StatTile from "../plant/StatTile";

const categories: EnvironmentalIncidentCategory[] = [
  "SPILL",
  "WATER_POLLUTION",
  "AIR_POLLUTION",
  "DUST_EXCEEDANCE",
  "WASTE_MISMANAGEMENT",
  "NOISE",
  "ECOLOGICAL_DAMAGE",
  "OTHER",
];
const severities: EnvironmentalIncidentSeverity[] = ["MINOR", "MODERATE", "MAJOR", "CATASTROPHIC"];
const remediationStatuses: EnvironmentalRemediationStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETE", "VERIFIED"];

function IncidentForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: EnvironmentalIncident;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [incidentDate, setIncidentDate] = useState(initial?.incidentDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<EnvironmentalIncidentCategory>(initial?.category ?? "SPILL");
  const [severity, setSeverity] = useState<EnvironmentalIncidentSeverity>(initial?.severity ?? "MINOR");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [receivingEnvironment, setReceivingEnvironment] = useState(initial?.receivingEnvironment ?? "");
  const [estimatedVolume, setEstimatedVolume] = useState(initial?.estimatedVolume?.toString() ?? "");
  const [volumeUnit, setVolumeUnit] = useState(initial?.volumeUnit ?? "");
  const [immediateActionTaken, setImmediateActionTaken] = useState(initial?.immediateActionTaken ?? "");
  const [regulatorNotificationRequired, setRegulatorNotificationRequired] = useState(initial?.regulatorNotificationRequired ?? false);
  const [regulatorNotifiedAt, setRegulatorNotifiedAt] = useState(initial?.regulatorNotifiedAt?.slice(0, 10) ?? "");
  const [regulatorNotifiedTo, setRegulatorNotifiedTo] = useState(initial?.regulatorNotifiedTo ?? "");
  const [remediationStatus, setRemediationStatus] = useState<EnvironmentalRemediationStatus>(initial?.remediationStatus ?? "NOT_STARTED");
  const [remediationCompletedAt, setRemediationCompletedAt] = useState(initial?.remediationCompletedAt?.slice(0, 10) ?? "");
  const [rootCause, setRootCause] = useState(initial?.rootCause ?? "");
  const [recurrencePrevented, setRecurrencePrevented] = useState(initial?.recurrencePrevented ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        incidentDate,
        category,
        severity,
        description,
        receivingEnvironment: receivingEnvironment || undefined,
        estimatedVolume: estimatedVolume ? Number(estimatedVolume) : null,
        volumeUnit: volumeUnit || undefined,
        immediateActionTaken: immediateActionTaken || undefined,
        regulatorNotificationRequired,
        regulatorNotifiedAt: regulatorNotifiedAt || null,
        regulatorNotifiedTo: regulatorNotifiedTo || undefined,
        remediationStatus,
        remediationCompletedAt: remediationCompletedAt || null,
        rootCause: rootCause || undefined,
        recurrencePrevented,
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
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.incidents.incidentDate")}</label>
          <DateField value={incidentDate} onChange={setIncidentDate} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.incidents.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as EnvironmentalIncidentCategory)}>
            {categories.map((c) => <option key={c} value={c}>{t(`environmentalRegisters.incidents.categories.${c}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.incidents.severity")}</label>
          <select className={selectClass} value={severity} onChange={(e) => setSeverity(e.target.value as EnvironmentalIncidentSeverity)}>
            {severities.map((s) => <option key={s} value={s}>{t(`environmentalRegisters.incidents.severities.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.incidents.receivingEnvironment")}</label>
          <input className={inputClass} value={receivingEnvironment} onChange={(e) => setReceivingEnvironment(e.target.value)} placeholder={t("environmentalRegisters.incidents.receivingEnvironmentHint")} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.incidents.estimatedVolume")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={estimatedVolume} onChange={(e) => setEstimatedVolume(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.incidents.volumeUnit")}</label>
          <input className={inputClass} value={volumeUnit} onChange={(e) => setVolumeUnit(e.target.value)} placeholder="litres / m³" />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("environmentalRegisters.incidents.immediateActionTaken")}</label>
        <textarea className={inputClass} rows={2} value={immediateActionTaken} onChange={(e) => setImmediateActionTaken(e.target.value)} />
      </div>

      <div className="space-y-3 bg-mine-900/40 border border-mine-800 rounded-xl p-4">
        <label className="flex items-center gap-2 text-sm text-mine-200">
          <input type="checkbox" checked={regulatorNotificationRequired} onChange={(e) => setRegulatorNotificationRequired(e.target.checked)} />
          {t("environmentalRegisters.incidents.regulatorNotificationRequired")}
        </label>
        <p className="text-[11px] text-mine-400">{t("environmentalRegisters.incidents.notificationHint")}</p>
        {regulatorNotificationRequired && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("environmentalRegisters.incidents.regulatorNotifiedAt")}</label>
              <DateField value={regulatorNotifiedAt} onChange={setRegulatorNotifiedAt} />
            </div>
            <div>
              <label className={labelClass}>{t("environmentalRegisters.incidents.regulatorNotifiedTo")}</label>
              <input className={inputClass} value={regulatorNotifiedTo} onChange={(e) => setRegulatorNotifiedTo(e.target.value)} placeholder="DWS / DMRE / Municipality" />
            </div>
          </div>
        )}
        {regulatorNotificationRequired && !regulatorNotifiedAt && (
          <p className="text-xs text-danger-500">{t("environmentalRegisters.incidents.notificationOutstandingWarning")}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.incidents.remediationStatus")}</label>
          <select className={selectClass} value={remediationStatus} onChange={(e) => setRemediationStatus(e.target.value as EnvironmentalRemediationStatus)} disabled={initial?.remediationStatus === "VERIFIED"}>
            {remediationStatuses
              .filter((s) => s !== "VERIFIED" || initial?.remediationStatus === "VERIFIED")
              .map((s) => <option key={s} value={s}>{t(`environmentalRegisters.incidents.remediationStatuses.${s}`)}</option>)}
          </select>
          {initial?.remediationStatus === "VERIFIED" && <p className="text-[11px] text-mine-400 mt-1">{t("environmentalRegisters.incidents.verifiedLocked")}</p>}
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.incidents.remediationCompletedAt")}</label>
          <DateField value={remediationCompletedAt} onChange={setRemediationCompletedAt} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("plantIntegrity.reliability.rootCause")}</label>
        <textarea className={inputClass} rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
      </div>
      <label className="flex items-start gap-2 text-sm text-mine-200">
        <input type="checkbox" className="mt-1" checked={recurrencePrevented} onChange={(e) => setRecurrencePrevented(e.target.checked)} />
        <span>
          {t("environmentalRegisters.incidents.recurrencePrevented")}
          <span className="block text-[11px] text-mine-400">{t("environmentalRegisters.incidents.recurrencePreventedHint")}</span>
        </span>
      </label>
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

export default function EnvironmentalIncidentsTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [incidents, setIncidents] = useState<EnvironmentalIncident[]>([]);
  const [summary, setSummary] = useState<EnvironmentalIncidentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | EnvironmentalIncident>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [i, s] = await Promise.all([
        api.get<EnvironmentalIncident[]>("/environmental-incidents"),
        api.get<EnvironmentalIncidentSummary>("/environmental-incidents/summary"),
      ]);
      setIncidents(i.data);
      setSummary(s.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(data: any) {
    await api.post("/environmental-incidents", data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/environmental-incidents/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("environmentalRegisters.incidents.confirmDelete"))) return;
    await api.delete(`/environmental-incidents/${id}`);
    await load();
  }
  async function verify(id: string) {
    if (!confirm(t("environmentalRegisters.incidents.confirmVerify"))) return;
    await api.post(`/environmental-incidents/${id}/verify`, { remediationStatus: "VERIFIED" });
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError || !summary) return <LoadError onRetry={load} />;

  const paretoData = Object.entries(summary.byCategory)
    .map(([category, count]) => ({ name: t(`environmentalRegisters.incidents.categories.${category}`), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const columns: DataTableColumn<EnvironmentalIncident>[] = [
    { key: "incidentDate", header: t("environmentalRegisters.incidents.incidentDate"), render: (i) => new Date(i.incidentDate).toLocaleDateString(), sortValue: (i) => i.incidentDate },
    { key: "site", header: t("common.site"), render: (i) => i.site?.name ?? "—", sortValue: (i) => i.site?.name ?? "" },
    { key: "category", header: t("environmentalRegisters.incidents.category"), render: (i) => t(`environmentalRegisters.incidents.categories.${i.category}`), sortValue: (i) => i.category },
    { key: "severity", header: t("environmentalRegisters.incidents.severity"), render: (i) => <StatusBadge status={i.severity} />, sortValue: (i) => severities.indexOf(i.severity) },
    {
      key: "notification",
      header: t("environmentalRegisters.incidents.notificationShort"),
      render: (i) => {
        if (!i.regulatorNotificationRequired) return <span className="text-mine-400">{t("environmentalRegisters.incidents.notRequired")}</span>;
        if (!i.regulatorNotifiedAt) return <span className="text-danger-500 font-semibold">{t("environmentalRegisters.incidents.outstanding")}</span>;
        return <span className="text-mine-200">{new Date(i.regulatorNotifiedAt).toLocaleDateString()}</span>;
      },
      sortValue: (i) => (i.regulatorNotificationRequired && !i.regulatorNotifiedAt ? 0 : 1),
    },
    { key: "remediationStatus", header: t("environmentalRegisters.incidents.remediationStatus"), render: (i) => <StatusBadge status={i.remediationStatus} />, sortValue: (i) => remediationStatuses.indexOf(i.remediationStatus) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("environmentalRegisters.incidents.statNotificationsOutstanding")}
          value={summary.notificationsOutstanding}
          target={t("environmentalRegisters.targetZero")}
          tone={summary.notificationsOutstanding === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("environmentalRegisters.incidents.statAvgNotificationHours")}
          value={summary.avgNotificationHours != null ? `${summary.avgNotificationHours} h` : "—"}
          target={t("environmentalRegisters.incidents.statAvgNotificationHoursTarget")}
        />
        <StatTile
          label={t("environmentalRegisters.incidents.statUnremediated")}
          value={summary.unremediated}
          target={t("environmentalRegisters.targetZero")}
          tone={summary.unremediated === 0 ? "good" : "warn"}
        />
        <StatTile
          label={t("environmentalRegisters.incidents.statUnverified")}
          value={summary.completeButUnverified}
          target={t("environmentalRegisters.targetZero")}
          tone={summary.completeButUnverified === 0 ? "good" : "warn"}
        />
      </div>

      <div className="bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6">
        <h2 className="text-sm font-semibold text-mine-200">{t("environmentalRegisters.incidents.paretoTitle")}</h2>
        <p className="text-xs text-mine-400 mb-3">{t("environmentalRegisters.incidents.paretoHint", { days: summary.windowDays })}</p>
        {paretoData.length === 0 ? (
          <div className="text-xs text-mine-400 py-12 text-center">{t("environmentalRegisters.incidents.noIncidents")}</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paretoData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={130} />
                <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {paretoData.map((d, i) => (
                    <Cell key={d.name} fill={i === 0 ? "#e13b2e" : i < 3 ? "#f0803c" : "#8a9ab5"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("environmentalRegisters.incidents.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("environmentalRegisters.incidents.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("environmentalRegisters.incidents.newIncident")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={incidents}
          rowKey={(i) => i.id}
          emptyMessage={t("environmentalRegisters.incidents.noneYet")}
          searchValue={(i) => `${i.description} ${i.receivingEnvironment ?? ""} ${i.rootCause ?? ""}`}
          exportFilename="environmental-incidents"
          exportColumns={[
            { header: t("environmentalRegisters.incidents.incidentDate"), value: (i) => i.incidentDate.slice(0, 10) },
            { header: t("common.site"), value: (i) => i.site?.name ?? "" },
            { header: t("environmentalRegisters.incidents.category"), value: (i) => i.category },
            { header: t("environmentalRegisters.incidents.severity"), value: (i) => i.severity },
            { header: t("environmentalRegisters.incidents.remediationStatus"), value: (i) => i.remediationStatus },
          ]}
          actions={(i) => (
            <div className="flex justify-end gap-2">
              {canEdit && i.remediationStatus === "COMPLETE" && <button className="text-xs text-success-500 hover:underline" onClick={() => verify(i.id)}>{t("environmentalRegisters.incidents.verify")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(i)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(i.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("environmentalRegisters.incidents.newIncidentTitle") : t("environmentalRegisters.incidents.editIncidentTitle")} onClose={() => setFormModal(null)}>
          <IncidentForm
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
