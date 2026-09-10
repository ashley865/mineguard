import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  AssetCriticality,
  AssetReliabilityProfile,
  AssetReliabilitySummary,
  Equipment,
  EquipmentFailure,
  EquipmentFailureMode,
} from "../../api/types";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import StatTile from "./StatTile";

const criticalities: AssetCriticality[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const failureModes: EquipmentFailureMode[] = [
  "MECHANICAL_WEAR",
  "BEARING_FAILURE",
  "LUBRICATION_FAILURE",
  "ELECTRICAL_FAULT",
  "HYDRAULIC_FAILURE",
  "PNEUMATIC_FAILURE",
  "STRUCTURAL_CRACK",
  "CONTROL_SYSTEM",
  "CONTAMINATION",
  "OVERLOAD",
  "CORROSION",
  "OPERATOR_ERROR",
  "OTHER",
];

const CRITICALITY_COLOR: Record<AssetCriticality, string> = {
  CRITICAL: "#e13b2e",
  HIGH: "#f0803c",
  MEDIUM: "#d9a441",
  LOW: "#8a9ab5",
};

function CriticalityTag({ value }: { value: AssetCriticality }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CRITICALITY_COLOR[value] }} />
      {t(`plantIntegrity.reliability.criticalities.${value}`)}
    </span>
  );
}

function ProfileForm({ equipment, profiles, initial, onSubmit, onCancel }: {
  equipment: Equipment[];
  profiles: AssetReliabilityProfile[];
  initial?: AssetReliabilityProfile;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  // On create, only offer assets that have no profile yet — one profile per asset,
  // and silently overwriting someone else's criticality call is not an edit action.
  const profiled = new Set(profiles.map((p) => p.equipmentId));
  const options = initial ? equipment.filter((e) => e.id === initial.equipmentId) : equipment.filter((e) => !profiled.has(e.id));

  const [equipmentId, setEquipmentId] = useState(initial?.equipmentId ?? options[0]?.id ?? "");
  const [criticality, setCriticality] = useState<AssetCriticality>(initial?.criticality ?? "MEDIUM");
  const [criticalityRationale, setCriticalityRationale] = useState(initial?.criticalityRationale ?? "");
  const [commissionedDate, setCommissionedDate] = useState(initial?.commissionedDate?.slice(0, 10) ?? "");
  const [expectedLifeYears, setExpectedLifeYears] = useState(initial?.expectedLifeYears?.toString() ?? "");
  const [replacementValue, setReplacementValue] = useState(initial?.replacementValue?.toString() ?? "");
  const [currentRunHours, setCurrentRunHours] = useState(initial?.currentRunHours?.toString() ?? "");
  const [targetAvailabilityPct, setTargetAvailabilityPct] = useState(initial?.targetAvailabilityPct?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        ...(initial ? {} : { equipmentId }),
        criticality,
        criticalityRationale: criticalityRationale || undefined,
        commissionedDate: commissionedDate || null,
        expectedLifeYears: expectedLifeYears ? Number(expectedLifeYears) : null,
        replacementValue: replacementValue ? Number(replacementValue) : null,
        currentRunHours: currentRunHours ? Number(currentRunHours) : null,
        targetAvailabilityPct: targetAvailabilityPct ? Number(targetAvailabilityPct) : null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  if (options.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-mine-300">{t("plantIntegrity.reliability.allProfiled")}</p>
        <div className="flex justify-end">
          <button className={buttonSecondary} onClick={onCancel}>{t("common.close")}</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("plantIntegrity.reliability.equipment")}</label>
        <select className={selectClass} value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} disabled={!!initial} required>
          {options.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.criticality")}</label>
          <select className={selectClass} value={criticality} onChange={(e) => setCriticality(e.target.value as AssetCriticality)}>
            {criticalities.map((c) => <option key={c} value={c}>{t(`plantIntegrity.reliability.criticalities.${c}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.targetAvailabilityPct")}</label>
          <input className={inputClass} type="number" min={0} max={100} step="0.1" value={targetAvailabilityPct} onChange={(e) => setTargetAvailabilityPct(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("plantIntegrity.reliability.criticalityRationale")}</label>
        <textarea className={inputClass} rows={2} value={criticalityRationale} onChange={(e) => setCriticalityRationale(e.target.value)} placeholder={t("plantIntegrity.reliability.rationaleHint")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.commissionedDate")}</label>
          <DateField value={commissionedDate} onChange={setCommissionedDate} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.expectedLifeYears")}</label>
          <input className={inputClass} type="number" min={0} max={200} value={expectedLifeYears} onChange={(e) => setExpectedLifeYears(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.replacementValue")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={replacementValue} onChange={(e) => setReplacementValue(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("plantIntegrity.reliability.currentRunHours")}</label>
        <input className={inputClass} type="number" min={0} step="0.1" value={currentRunHours} onChange={(e) => setCurrentRunHours(e.target.value)} />
        <p className="text-[11px] text-mine-400 mt-1">{t("plantIntegrity.reliability.runHoursHint")}</p>
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

function FailureForm({ equipment, initial, onSubmit, onCancel }: {
  equipment: Equipment[];
  initial?: EquipmentFailure;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [equipmentId, setEquipmentId] = useState(initial?.equipmentId ?? equipment[0]?.id ?? "");
  const [failureDate, setFailureDate] = useState(initial?.failureDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [failureMode, setFailureMode] = useState<EquipmentFailureMode>(initial?.failureMode ?? "MECHANICAL_WEAR");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [detectedBy, setDetectedBy] = useState(initial?.detectedBy ?? "");
  const [downtimeHours, setDowntimeHours] = useState(initial?.downtimeHours?.toString() ?? "");
  const [repairCost, setRepairCost] = useState(initial?.repairCost?.toString() ?? "");
  const [runHoursAtFailure, setRunHoursAtFailure] = useState(initial?.runHoursAtFailure?.toString() ?? "");
  const [rootCause, setRootCause] = useState(initial?.rootCause ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(initial?.correctiveAction ?? "");
  const [recurrencePrevented, setRecurrencePrevented] = useState(initial?.recurrencePrevented ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        ...(initial ? {} : { equipmentId }),
        failureDate,
        failureMode,
        description,
        detectedBy: detectedBy || undefined,
        downtimeHours: downtimeHours ? Number(downtimeHours) : null,
        repairCost: repairCost ? Number(repairCost) : null,
        runHoursAtFailure: runHoursAtFailure ? Number(runHoursAtFailure) : null,
        rootCause: rootCause || undefined,
        correctiveAction: correctiveAction || undefined,
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
          <label className={labelClass}>{t("plantIntegrity.reliability.equipment")}</label>
          <select className={selectClass} value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} disabled={!!initial} required>
            {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.failureDate")}</label>
          <DateField value={failureDate} onChange={setFailureDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("plantIntegrity.reliability.failureMode")}</label>
        <select className={selectClass} value={failureMode} onChange={(e) => setFailureMode(e.target.value as EquipmentFailureMode)}>
          {failureModes.map((m) => <option key={m} value={m}>{t(`plantIntegrity.reliability.failureModes.${m}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.detectedBy")}</label>
          <input className={inputClass} value={detectedBy} onChange={(e) => setDetectedBy(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.runHoursAtFailure")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={runHoursAtFailure} onChange={(e) => setRunHoursAtFailure(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.downtimeHours")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={downtimeHours} onChange={(e) => setDowntimeHours(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.reliability.repairCost")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("plantIntegrity.reliability.rootCause")}</label>
        <textarea className={inputClass} rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("plantIntegrity.reliability.correctiveAction")}</label>
        <textarea className={inputClass} rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
      </div>
      <label className="flex items-start gap-2 text-sm text-mine-200">
        <input type="checkbox" className="mt-1" checked={recurrencePrevented} onChange={(e) => setRecurrencePrevented(e.target.checked)} />
        <span>
          {t("plantIntegrity.reliability.recurrencePrevented")}
          <span className="block text-[11px] text-mine-400">{t("plantIntegrity.reliability.recurrencePreventedHint")}</span>
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

export default function AssetReliabilityTab({ equipment }: { equipment: Equipment[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [profiles, setProfiles] = useState<AssetReliabilityProfile[]>([]);
  const [failures, setFailures] = useState<EquipmentFailure[]>([]);
  const [summary, setSummary] = useState<AssetReliabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [profileModal, setProfileModal] = useState<null | "create" | AssetReliabilityProfile>(null);
  const [failureModal, setFailureModal] = useState<null | "create" | EquipmentFailure>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [p, f, s] = await Promise.all([
        api.get<AssetReliabilityProfile[]>("/asset-reliability/profiles"),
        api.get<EquipmentFailure[]>("/asset-reliability/failures"),
        api.get<AssetReliabilitySummary>("/asset-reliability/summary"),
      ]);
      setProfiles(p.data);
      setFailures(f.data);
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

  async function createProfile(data: any) {
    await api.post("/asset-reliability/profiles", data);
    setProfileModal(null);
    await load();
  }
  async function updateProfile(id: string, data: any) {
    await api.put(`/asset-reliability/profiles/${id}`, data);
    setProfileModal(null);
    await load();
  }
  async function removeProfile(id: string) {
    if (!confirm(t("plantIntegrity.reliability.confirmDeleteProfile"))) return;
    await api.delete(`/asset-reliability/profiles/${id}`);
    await load();
  }
  async function createFailure(data: any) {
    await api.post("/asset-reliability/failures", data);
    setFailureModal(null);
    await load();
  }
  async function updateFailure(id: string, data: any) {
    await api.put(`/asset-reliability/failures/${id}`, data);
    setFailureModal(null);
    await load();
  }
  async function removeFailure(id: string) {
    if (!confirm(t("plantIntegrity.reliability.confirmDeleteFailure"))) return;
    await api.delete(`/asset-reliability/failures/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError || !summary) return <LoadError onRetry={load} />;

  const paretoData = summary.failureModeBreakdown.slice(0, 8).map((m) => ({
    name: t(`plantIntegrity.reliability.failureModes.${m.failureMode}`),
    hours: Number(m.downtimeHours.toFixed(1)),
    count: m.count,
  }));

  const profileColumns: DataTableColumn<AssetReliabilityProfile>[] = [
    { key: "equipment", header: t("plantIntegrity.reliability.equipment"), render: (p) => p.equipment?.name ?? "—", sortValue: (p) => p.equipment?.name ?? "" },
    { key: "criticality", header: t("plantIntegrity.reliability.criticality"), render: (p) => <CriticalityTag value={p.criticality} />, sortValue: (p) => criticalities.indexOf(p.criticality) },
    {
      key: "currentRunHours",
      header: t("plantIntegrity.reliability.runHoursShort"),
      render: (p) => (p.currentRunHours != null ? p.currentRunHours.toLocaleString(undefined, { maximumFractionDigits: 0 }) : <span className="text-hazard-500">{t("plantIntegrity.notSet")}</span>),
      sortValue: (p) => p.currentRunHours ?? -1,
    },
    {
      key: "targetAvailabilityPct",
      header: t("plantIntegrity.reliability.targetShort"),
      render: (p) => (p.targetAvailabilityPct != null ? `${p.targetAvailabilityPct}%` : "—"),
      sortValue: (p) => p.targetAvailabilityPct ?? -1,
    },
    {
      key: "replacementValue",
      header: t("plantIntegrity.reliability.replacementValue"),
      render: (p) => (p.replacementValue != null ? p.replacementValue.toLocaleString() : "—"),
      sortValue: (p) => p.replacementValue ?? -1,
    },
  ];

  const failureColumns: DataTableColumn<EquipmentFailure>[] = [
    { key: "failureDate", header: t("plantIntegrity.reliability.failureDate"), render: (f) => new Date(f.failureDate).toLocaleDateString(), sortValue: (f) => f.failureDate },
    { key: "equipment", header: t("plantIntegrity.reliability.equipment"), render: (f) => f.equipment?.name ?? "—", sortValue: (f) => f.equipment?.name ?? "" },
    { key: "failureMode", header: t("plantIntegrity.reliability.failureMode"), render: (f) => t(`plantIntegrity.reliability.failureModes.${f.failureMode}`), sortValue: (f) => f.failureMode },
    {
      key: "downtimeHours",
      header: t("plantIntegrity.reliability.downtimeShort"),
      render: (f) => (f.downtimeHours != null ? `${f.downtimeHours.toLocaleString()} h` : "—"),
      sortValue: (f) => f.downtimeHours ?? -1,
    },
    {
      key: "rootCause",
      header: t("plantIntegrity.reliability.rootCause"),
      render: (f) => (f.rootCause ? <span className="text-mine-200">{f.rootCause}</span> : <span className="text-hazard-500">{t("plantIntegrity.reliability.noRootCause")}</span>),
      sortValue: (f) => f.rootCause ?? "",
    },
    {
      key: "recurrencePrevented",
      header: t("plantIntegrity.reliability.rcaShort"),
      render: (f) => (f.recurrencePrevented ? <span className="text-success-500">{t("common.yes")}</span> : <span className="text-mine-400">{t("common.no")}</span>),
      sortValue: (f) => (f.recurrencePrevented ? 1 : 0),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("plantIntegrity.reliability.statDowntime", { days: summary.windowDays })}
          value={`${summary.totalDowntimeHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`}
          target={t("plantIntegrity.reliability.statDowntimeTarget")}
          tone={summary.totalDowntimeHours === 0 ? "good" : undefined}
        />
        <StatTile
          label={t("plantIntegrity.reliability.statBelowTarget")}
          value={summary.assetsBelowTarget}
          target={t("plantIntegrity.targetZero")}
          tone={summary.assetsBelowTarget === 0 ? "good" : "bad"}
          hint={t("plantIntegrity.reliability.statBelowTargetHint", { count: summary.profiledAssets })}
        />
        <StatTile
          label={t("plantIntegrity.reliability.statRca")}
          value={summary.rcaCompletionPct != null ? `${summary.rcaCompletionPct.toFixed(0)}%` : "—"}
          target={t("plantIntegrity.reliability.statRcaTarget")}
          tone={summary.rcaCompletionPct == null ? undefined : summary.rcaCompletionPct >= 80 ? "good" : summary.rcaCompletionPct >= 50 ? "warn" : "bad"}
        />
        <StatTile
          label={t("plantIntegrity.reliability.statCritical")}
          value={summary.criticalAssets}
          target={t("plantIntegrity.reliability.statCriticalTarget")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6">
          <h2 className="text-sm font-semibold text-mine-200">{t("plantIntegrity.reliability.paretoTitle")}</h2>
          <p className="text-xs text-mine-400 mb-3">{t("plantIntegrity.reliability.paretoHint", { days: summary.windowDays })}</p>
          {paretoData.length === 0 ? (
            <div className="text-xs text-mine-400 py-12 text-center">{t("plantIntegrity.reliability.noFailures")}</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paretoData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={130} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey="hours" name={t("plantIntegrity.reliability.downtimeShort")} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {paretoData.map((d, i) => (
                      <Cell key={d.name} fill={i === 0 ? "#e13b2e" : i < 3 ? "#f0803c" : "#8a9ab5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6">
          <h2 className="text-sm font-semibold text-mine-200">{t("plantIntegrity.reliability.worstAssetsTitle")}</h2>
          <p className="text-xs text-mine-400 mb-3">{t("plantIntegrity.reliability.worstAssetsHint")}</p>
          {summary.assets.length === 0 ? (
            <div className="text-xs text-mine-400 py-12 text-center">{t("plantIntegrity.reliability.noProfiles")}</div>
          ) : (
            <ul className="divide-y divide-mine-800">
              {summary.assets.slice(0, 8).map((a) => (
                <li key={a.equipmentId} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-mine-100 truncate">{a.equipmentName}</p>
                    <p className="text-[11px] text-mine-400">
                      <CriticalityTag value={a.criticality} />
                      {" · "}
                      {t("plantIntegrity.reliability.failuresCount", { count: a.failureCount })}
                      {a.mtbfHours != null ? ` · ${t("plantIntegrity.reliability.mtbf", { hours: Math.round(a.mtbfHours).toLocaleString() })}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm tabular-nums ${a.belowTarget ? "text-danger-500" : "text-mine-100"}`}>{a.availabilityPct.toFixed(1)}%</p>
                    <p className="text-[11px] text-mine-400 tabular-nums">
                      {a.targetAvailabilityPct != null ? t("plantIntegrity.reliability.vsTarget", { target: a.targetAvailabilityPct }) : t("plantIntegrity.reliability.noTargetSet")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("plantIntegrity.reliability.profilesTitle")}</h2>
            <p className="text-xs text-mine-400">{t("plantIntegrity.reliability.profilesHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setProfileModal("create")} disabled={equipment.length === 0}>{t("plantIntegrity.reliability.newProfile")}</button>}
        </div>
        <DataTable
          columns={profileColumns}
          rows={profiles}
          rowKey={(p) => p.id}
          emptyMessage={t("plantIntegrity.reliability.noProfiles")}
          searchValue={(p) => `${p.equipment?.name ?? ""} ${p.criticalityRationale ?? ""}`}
          exportFilename="asset-reliability-profiles"
          exportColumns={[
            { header: t("plantIntegrity.reliability.equipment"), value: (p) => p.equipment?.name ?? "" },
            { header: t("plantIntegrity.reliability.criticality"), value: (p) => p.criticality },
            { header: t("plantIntegrity.reliability.runHoursShort"), value: (p) => (p.currentRunHours != null ? String(p.currentRunHours) : "") },
            { header: t("plantIntegrity.reliability.targetShort"), value: (p) => (p.targetAvailabilityPct != null ? String(p.targetAvailabilityPct) : "") },
            { header: t("plantIntegrity.reliability.replacementValue"), value: (p) => (p.replacementValue != null ? String(p.replacementValue) : "") },
          ]}
          actions={(p) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setProfileModal(p)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removeProfile(p.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("plantIntegrity.reliability.failuresTitle")}</h2>
            <p className="text-xs text-mine-400">{t("plantIntegrity.reliability.failuresHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFailureModal("create")} disabled={equipment.length === 0}>{t("plantIntegrity.reliability.newFailure")}</button>}
        </div>
        <DataTable
          columns={failureColumns}
          rows={failures}
          rowKey={(f) => f.id}
          emptyMessage={t("plantIntegrity.reliability.noFailures")}
          searchValue={(f) => `${f.equipment?.name ?? ""} ${f.description} ${f.rootCause ?? ""}`}
          exportFilename="equipment-failures"
          exportColumns={[
            { header: t("plantIntegrity.reliability.failureDate"), value: (f) => f.failureDate.slice(0, 10) },
            { header: t("plantIntegrity.reliability.equipment"), value: (f) => f.equipment?.name ?? "" },
            { header: t("plantIntegrity.reliability.failureMode"), value: (f) => f.failureMode },
            { header: t("common.description"), value: (f) => f.description },
            { header: t("plantIntegrity.reliability.downtimeShort"), value: (f) => (f.downtimeHours != null ? String(f.downtimeHours) : "") },
            { header: t("plantIntegrity.reliability.repairCost"), value: (f) => (f.repairCost != null ? String(f.repairCost) : "") },
            { header: t("plantIntegrity.reliability.rootCause"), value: (f) => f.rootCause ?? "" },
          ]}
          actions={(f) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFailureModal(f)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removeFailure(f.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {profileModal && (
        <Modal title={profileModal === "create" ? t("plantIntegrity.reliability.newProfileTitle") : t("plantIntegrity.reliability.editProfileTitle")} onClose={() => setProfileModal(null)}>
          <ProfileForm
            equipment={equipment}
            profiles={profiles}
            initial={profileModal === "create" ? undefined : profileModal}
            onSubmit={(data) => (profileModal === "create" ? createProfile(data) : updateProfile(profileModal.id, data))}
            onCancel={() => setProfileModal(null)}
          />
        </Modal>
      )}

      {failureModal && (
        <Modal title={failureModal === "create" ? t("plantIntegrity.reliability.newFailureTitle") : t("plantIntegrity.reliability.editFailureTitle")} onClose={() => setFailureModal(null)}>
          <FailureForm
            equipment={equipment}
            initial={failureModal === "create" ? undefined : failureModal}
            onSubmit={(data) => (failureModal === "create" ? createFailure(data) : updateFailure(failureModal.id, data))}
            onCancel={() => setFailureModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
