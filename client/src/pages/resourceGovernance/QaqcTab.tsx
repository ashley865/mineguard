import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { DrillHole, MineralType, QaqcResult, QaqcSample, QaqcSampleType, QaqcSummary, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import StatTile from "../plant/StatTile";

const sampleTypes: QaqcSampleType[] = ["CERTIFIED_REFERENCE_STANDARD", "FIELD_DUPLICATE", "PULP_DUPLICATE", "BLANK", "CHECK_ASSAY"];
const mineralTypes: MineralType[] = [
  "GOLD",
  "PLATINUM_GROUP_METALS",
  "DIAMOND",
  "COAL",
  "IRON_ORE",
  "CHROME",
  "MANGANESE",
  "COPPER",
  "ZINC",
  "NICKEL",
  "URANIUM",
  "COBALT",
  "LIMESTONE",
  "SAND_AND_AGGREGATE",
  "OTHER",
];

function SampleForm({ sites, drillHoles, initial, onSubmit, onCancel }: {
  sites: Site[];
  drillHoles: DrillHole[];
  initial?: QaqcSample;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [drillHoleId, setDrillHoleId] = useState(initial?.drillHoleId ?? "");
  const [sampleType, setSampleType] = useState<QaqcSampleType>(initial?.sampleType ?? "CERTIFIED_REFERENCE_STANDARD");
  const [sampleDate, setSampleDate] = useState(initial?.sampleDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [labName, setLabName] = useState(initial?.labName ?? "");
  const [batchNumber, setBatchNumber] = useState(initial?.batchNumber ?? "");
  const [mineralType, setMineralType] = useState<MineralType>(initial?.mineralType ?? "GOLD");
  const [referenceValue, setReferenceValue] = useState(initial?.referenceValue?.toString() ?? "");
  const [measuredValue, setMeasuredValue] = useState(initial?.measuredValue?.toString() ?? "");
  const [toleranceRangeLow, setToleranceRangeLow] = useState(initial?.toleranceRangeLow?.toString() ?? "");
  const [toleranceRangeHigh, setToleranceRangeHigh] = useState(initial?.toleranceRangeHigh?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const holesForSite = drillHoles.filter((h) => h.siteId === siteId);
  const referenceLabel =
    sampleType === "BLANK"
      ? t("resourceGovernance.qaqc.expectedNearZero")
      : sampleType === "FIELD_DUPLICATE" || sampleType === "PULP_DUPLICATE"
        ? t("resourceGovernance.qaqc.originalValue")
        : t("resourceGovernance.qaqc.certifiedValue");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        drillHoleId: drillHoleId || null,
        sampleType,
        sampleDate,
        labName: labName || undefined,
        batchNumber: batchNumber || undefined,
        mineralType,
        referenceValue: referenceValue ? Number(referenceValue) : null,
        measuredValue: measuredValue ? Number(measuredValue) : null,
        toleranceRangeLow: toleranceRangeLow ? Number(toleranceRangeLow) : null,
        toleranceRangeHigh: toleranceRangeHigh ? Number(toleranceRangeHigh) : null,
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
          <label className={labelClass}>{t("resourceGovernance.qaqc.sampleType")}</label>
          <select className={selectClass} value={sampleType} onChange={(e) => setSampleType(e.target.value as QaqcSampleType)}>
            {sampleTypes.map((v) => <option key={v} value={v}>{t(`resourceGovernance.qaqc.sampleTypes.${v}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.qaqc.sampleDate")}</label>
          <DateField value={sampleDate} onChange={setSampleDate} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select
            className={selectClass}
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setDrillHoleId("");
            }}
            required
          >
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.qaqc.drillHole")}</label>
          <select className={selectClass} value={drillHoleId} onChange={(e) => setDrillHoleId(e.target.value)}>
            <option value="">{t("resourceGovernance.qaqc.notTiedToHole")}</option>
            {holesForSite.map((h) => <option key={h.id} value={h.id}>{h.holeId}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("resourceGovernance.qaqc.mineralType")}</label>
        <select className={selectClass} value={mineralType} onChange={(e) => setMineralType(e.target.value as MineralType)}>
          {mineralTypes.map((m) => <option key={m} value={m}>{t(`mineralTypes.${m}`)}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.qaqc.labName")}</label>
          <input className={inputClass} value={labName} onChange={(e) => setLabName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.qaqc.batchNumber")}</label>
          <input className={inputClass} value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{referenceLabel}</label>
          <input className={inputClass} type="number" step="any" value={referenceValue} onChange={(e) => setReferenceValue(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.qaqc.measuredValue")}</label>
          <input className={inputClass} type="number" step="any" value={measuredValue} onChange={(e) => setMeasuredValue(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.qaqc.toleranceLow")}</label>
          <input className={inputClass} type="number" step="any" value={toleranceRangeLow} onChange={(e) => setToleranceRangeLow(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.qaqc.toleranceHigh")}</label>
          <input className={inputClass} type="number" step="any" value={toleranceRangeHigh} onChange={(e) => setToleranceRangeHigh(e.target.value)} />
        </div>
      </div>
      <p className="text-[11px] text-mine-400">{t("resourceGovernance.qaqc.resultHint")}</p>
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

export default function QaqcTab({ sites, drillHoles }: { sites: Site[]; drillHoles: DrillHole[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [samples, setSamples] = useState<QaqcSample[]>([]);
  const [summary, setSummary] = useState<QaqcSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | QaqcSample>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [s, sum] = await Promise.all([
        api.get<QaqcSample[]>("/qaqc"),
        api.get<QaqcSummary>("/qaqc/summary"),
      ]);
      setSamples(s.data);
      setSummary(sum.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byTypeRows = useMemo(() => {
    if (!summary) return [];
    return sampleTypes
      .map((type) => {
        const bucket = summary.byType[type];
        if (!bucket) return null;
        return { type, ...bucket, passRatePct: bucket.total > 0 ? Math.round(((bucket.total - bucket.fail) / bucket.total) * 100) : null };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
  }, [summary]);

  async function create(data: any) {
    await api.post("/qaqc", data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/qaqc/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("resourceGovernance.qaqc.confirmDelete"))) return;
    await api.delete(`/qaqc/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError || !summary) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<QaqcSample>[] = [
    { key: "sampleDate", header: t("resourceGovernance.qaqc.sampleDate"), render: (s) => new Date(s.sampleDate).toLocaleDateString(), sortValue: (s) => s.sampleDate },
    { key: "sampleType", header: t("resourceGovernance.qaqc.sampleType"), render: (s) => t(`resourceGovernance.qaqc.sampleTypes.${s.sampleType}`), sortValue: (s) => s.sampleType },
    { key: "site", header: t("common.site"), render: (s) => s.site?.name ?? "—", sortValue: (s) => s.site?.name ?? "" },
    { key: "drillHole", header: t("resourceGovernance.qaqc.drillHole"), render: (s) => s.drillHole?.holeId ?? "—", sortValue: (s) => s.drillHole?.holeId ?? "" },
    { key: "labName", header: t("resourceGovernance.qaqc.labName"), render: (s) => s.labName || "—", sortValue: (s) => s.labName ?? "" },
    {
      key: "values",
      header: t("resourceGovernance.qaqc.measuredVsReference"),
      render: (s) => (s.measuredValue != null ? `${s.measuredValue}${s.referenceValue != null ? ` / ${s.referenceValue}` : ""}` : "—"),
      sortValue: (s) => s.measuredValue ?? -1,
    },
    { key: "result", header: t("resourceGovernance.qaqc.result"), render: (s) => <StatusBadge status={s.result} />, sortValue: (s) => s.result },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("resourceGovernance.qaqc.statPassRate", { days: summary.windowDays })}
          value={summary.passRatePct != null ? `${summary.passRatePct}%` : "—"}
          target={t("resourceGovernance.qaqc.statPassRateTarget")}
          tone={summary.passRatePct == null ? undefined : summary.passRatePct >= 95 ? "good" : summary.passRatePct >= 85 ? "warn" : "bad"}
        />
        <StatTile
          label={t("resourceGovernance.qaqc.statFail")}
          value={summary.fail}
          target={t("resourceGovernance.targetZero")}
          tone={summary.fail === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("resourceGovernance.qaqc.statWarning")}
          value={summary.warning}
          target={t("resourceGovernance.qaqc.statWarningTarget")}
          tone={summary.warning === 0 ? "good" : "warn"}
        />
        <StatTile label={t("resourceGovernance.qaqc.statTotal", { days: summary.windowDays })} value={summary.total} target={t("resourceGovernance.qaqc.statTotalTarget")} />
      </div>

      <div className="bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6">
        <h2 className="text-sm font-semibold text-mine-200">{t("resourceGovernance.qaqc.byTypeTitle")}</h2>
        <p className="text-xs text-mine-400 mb-3">{t("resourceGovernance.qaqc.byTypeHint")}</p>
        {byTypeRows.length === 0 ? (
          <div className="text-xs text-mine-400 py-8 text-center">{t("resourceGovernance.qaqc.noSamplesYet")}</div>
        ) : (
          <ul className="divide-y divide-mine-800">
            {byTypeRows.map((r) => (
              <li key={r.type} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-mine-100">{t(`resourceGovernance.qaqc.sampleTypes.${r.type}`)}</p>
                  <p className="text-[11px] text-mine-400">{t("resourceGovernance.qaqc.sampleCount", { count: r.total })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm tabular-nums ${r.passRatePct != null && r.passRatePct < 95 ? "text-hazard-500" : "text-mine-100"}`}>
                    {r.passRatePct != null ? `${r.passRatePct}%` : "—"}
                  </p>
                  {r.fail > 0 && <p className="text-[11px] text-danger-500 tabular-nums">{t("resourceGovernance.qaqc.failCount", { count: r.fail })}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("resourceGovernance.qaqc.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("resourceGovernance.qaqc.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("resourceGovernance.qaqc.newSample")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={samples}
          rowKey={(s) => s.id}
          emptyMessage={t("resourceGovernance.qaqc.noSamplesYet")}
          searchValue={(s) => `${s.labName ?? ""} ${s.batchNumber ?? ""} ${s.drillHole?.holeId ?? ""}`}
          exportFilename="qaqc-samples"
          exportColumns={[
            { header: t("resourceGovernance.qaqc.sampleDate"), value: (s) => s.sampleDate.slice(0, 10) },
            { header: t("resourceGovernance.qaqc.sampleType"), value: (s) => s.sampleType },
            { header: t("common.site"), value: (s) => s.site?.name ?? "" },
            { header: t("resourceGovernance.qaqc.labName"), value: (s) => s.labName ?? "" },
            { header: t("resourceGovernance.qaqc.result"), value: (s) => s.result },
          ]}
          actions={(s) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(s)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(s.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("resourceGovernance.qaqc.newSampleTitle") : t("resourceGovernance.qaqc.editSampleTitle")} onClose={() => setFormModal(null)}>
          <SampleForm
            sites={sites}
            drillHoles={drillHoles}
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(data) => (formModal === "create" ? create(data) : update(formModal.id, data))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
