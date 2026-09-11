import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { GradeReconciliation, GradeReconciliationSummary, MineralType, Site } from "../../api/types";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import StatTile from "../plant/StatTile";

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

function ReconciliationForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: GradeReconciliation;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(initial?.periodStart?.slice(0, 10) ?? "");
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd?.slice(0, 10) ?? "");
  const [mineralType, setMineralType] = useState<MineralType>(initial?.mineralType ?? "GOLD");
  const [estimatedTonnes, setEstimatedTonnes] = useState(initial?.estimatedTonnes?.toString() ?? "");
  const [estimatedGrade, setEstimatedGrade] = useState(initial?.estimatedGrade?.toString() ?? "");
  const [gradeUnit, setGradeUnit] = useState(initial?.gradeUnit ?? "g/t");
  const [actualTonnesMined, setActualTonnesMined] = useState(initial?.actualTonnesMined?.toString() ?? "");
  const [actualGradeMined, setActualGradeMined] = useState(initial?.actualGradeMined?.toString() ?? "");
  const [actualTonnesMilled, setActualTonnesMilled] = useState(initial?.actualTonnesMilled?.toString() ?? "");
  const [actualGradeMilled, setActualGradeMilled] = useState(initial?.actualGradeMilled?.toString() ?? "");
  const [varianceExplanation, setVarianceExplanation] = useState(initial?.varianceExplanation ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        periodStart,
        periodEnd,
        mineralType,
        estimatedTonnes: Number(estimatedTonnes),
        estimatedGrade: Number(estimatedGrade),
        gradeUnit: gradeUnit || undefined,
        actualTonnesMined: actualTonnesMined ? Number(actualTonnesMined) : null,
        actualGradeMined: actualGradeMined ? Number(actualGradeMined) : null,
        actualTonnesMilled: actualTonnesMilled ? Number(actualTonnesMilled) : null,
        actualGradeMilled: actualGradeMilled ? Number(actualGradeMilled) : null,
        varianceExplanation: varianceExplanation || undefined,
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
          <label className={labelClass}>{t("resourceGovernance.reconciliation.mineralType")}</label>
          <select className={selectClass} value={mineralType} onChange={(e) => setMineralType(e.target.value as MineralType)}>
            {mineralTypes.map((m) => <option key={m} value={m}>{t(`mineralTypes.${m}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.reconciliation.periodStart")}</label>
          <DateField value={periodStart} onChange={setPeriodStart} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.reconciliation.periodEnd")}</label>
          <DateField value={periodEnd} onChange={setPeriodEnd} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 bg-mine-900/40 border border-mine-800 rounded-xl p-4">
        <div className="col-span-3 text-xs font-semibold text-mine-300">{t("resourceGovernance.reconciliation.estimatedSectionTitle")}</div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.reconciliation.estimatedTonnes")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={estimatedTonnes} onChange={(e) => setEstimatedTonnes(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.reconciliation.estimatedGrade")}</label>
          <input className={inputClass} type="number" min={0} step="0.0001" value={estimatedGrade} onChange={(e) => setEstimatedGrade(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.reconciliation.gradeUnit")}</label>
          <input className={inputClass} value={gradeUnit} onChange={(e) => setGradeUnit(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 bg-mine-900/40 border border-mine-800 rounded-xl p-4">
        <div className="col-span-2 text-xs font-semibold text-mine-300">{t("resourceGovernance.reconciliation.minedSectionTitle")}</div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.reconciliation.actualTonnesMined")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={actualTonnesMined} onChange={(e) => setActualTonnesMined(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.reconciliation.actualGradeMined")}</label>
          <input className={inputClass} type="number" min={0} step="0.0001" value={actualGradeMined} onChange={(e) => setActualGradeMined(e.target.value)} />
        </div>
        <div className="col-span-2 text-xs font-semibold text-mine-300 pt-2">{t("resourceGovernance.reconciliation.milledSectionTitle")}</div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.reconciliation.actualTonnesMilled")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={actualTonnesMilled} onChange={(e) => setActualTonnesMilled(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.reconciliation.actualGradeMilled")}</label>
          <input className={inputClass} type="number" min={0} step="0.0001" value={actualGradeMilled} onChange={(e) => setActualGradeMilled(e.target.value)} />
        </div>
      </div>
      <p className="text-[11px] text-mine-400">{t("resourceGovernance.reconciliation.milledPreferredHint")}</p>
      <div>
        <label className={labelClass}>{t("resourceGovernance.reconciliation.varianceExplanation")}</label>
        <textarea className={inputClass} rows={2} value={varianceExplanation} onChange={(e) => setVarianceExplanation(e.target.value)} placeholder={t("resourceGovernance.reconciliation.varianceExplanationHint")} />
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

export default function GradeReconciliationTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [records, setRecords] = useState<GradeReconciliation[]>([]);
  const [summary, setSummary] = useState<GradeReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | GradeReconciliation>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [r, s] = await Promise.all([
        api.get<GradeReconciliation[]>("/grade-reconciliation"),
        api.get<GradeReconciliationSummary>("/grade-reconciliation/summary"),
      ]);
      setRecords(r.data);
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
    await api.post("/grade-reconciliation", data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/grade-reconciliation/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("resourceGovernance.reconciliation.confirmDelete"))) return;
    await api.delete(`/grade-reconciliation/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError || !summary) return <LoadError onRetry={load} />;

  const chartData = summary.trend.map((p) => ({
    date: new Date(p.period).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
    mcf: p.mcf,
  }));

  const avgMcfEntries = Object.entries(summary.avgMcfByMineral);

  const columns: DataTableColumn<GradeReconciliation>[] = [
    { key: "period", header: t("resourceGovernance.reconciliation.period"), render: (r) => `${new Date(r.periodStart).toLocaleDateString()} – ${new Date(r.periodEnd).toLocaleDateString()}`, sortValue: (r) => r.periodStart },
    { key: "site", header: t("common.site"), render: (r) => r.site?.name ?? "—", sortValue: (r) => r.site?.name ?? "" },
    { key: "mineralType", header: t("resourceGovernance.reconciliation.mineralType"), render: (r) => t(`mineralTypes.${r.mineralType}`), sortValue: (r) => r.mineralType },
    {
      key: "mcf",
      header: t("resourceGovernance.reconciliation.mcfShort"),
      render: (r) =>
        r.mineCallFactorPct != null ? (
          <span className={Math.abs(r.mineCallFactorPct - 100) > 10 ? "text-hazard-500 font-semibold" : "text-mine-100"}>{r.mineCallFactorPct}%</span>
        ) : (
          <span className="text-hazard-500">{t("resourceGovernance.reconciliation.awaitingActuals")}</span>
        ),
      sortValue: (r) => r.mineCallFactorPct ?? -1,
    },
    {
      key: "varianceExplanation",
      header: t("resourceGovernance.reconciliation.varianceExplanation"),
      render: (r) =>
        r.mineCallFactorPct != null && Math.abs(r.mineCallFactorPct - 100) > 10 && !r.varianceExplanation ? (
          <span className="text-danger-500">{t("resourceGovernance.reconciliation.noExplanation")}</span>
        ) : (
          r.varianceExplanation || "—"
        ),
      sortValue: (r) => r.varianceExplanation ?? "",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label={t("resourceGovernance.reconciliation.statPeriods", { months: summary.windowMonths })} value={summary.periodsRecorded} target={t("resourceGovernance.reconciliation.statPeriodsTarget")} />
        <StatTile
          label={t("resourceGovernance.reconciliation.statAwaitingActuals")}
          value={summary.periodsAwaitingActuals}
          target={t("resourceGovernance.targetZero")}
          tone={summary.periodsAwaitingActuals === 0 ? "good" : "warn"}
        />
        <StatTile
          label={t("resourceGovernance.reconciliation.statUnexplained")}
          value={summary.unexplainedVariances}
          target={t("resourceGovernance.targetZero")}
          tone={summary.unexplainedVariances === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("resourceGovernance.reconciliation.statOverallMcf")}
          value={avgMcfEntries.length > 0 ? `${Math.round(avgMcfEntries.reduce((s, [, v]) => s + v, 0) / avgMcfEntries.length)}%` : "—"}
          target={t("resourceGovernance.reconciliation.statOverallMcfTarget")}
        />
      </div>

      <div className="bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6">
        <h2 className="text-sm font-semibold text-mine-200">{t("resourceGovernance.reconciliation.trendTitle")}</h2>
        <p className="text-xs text-mine-400 mb-3">{t("resourceGovernance.reconciliation.trendHint")}</p>
        {chartData.length < 2 ? (
          <div className="text-xs text-mine-400 py-12 text-center">{t("resourceGovernance.reconciliation.notEnoughData")}</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#52525b" }} domain={["dataMin - 10", "dataMax + 10"]} />
                <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={100} stroke="#8a9ab5" strokeDasharray="4 4" label={{ value: "100%", fontSize: 10, fill: "#8a9ab5" }} />
                <Line type="monotone" dataKey="mcf" name={t("resourceGovernance.reconciliation.mcfShort")} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("resourceGovernance.reconciliation.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("resourceGovernance.reconciliation.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("resourceGovernance.reconciliation.newRecord")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={records}
          rowKey={(r) => r.id}
          emptyMessage={t("resourceGovernance.reconciliation.noneYet")}
          searchValue={(r) => `${r.site?.name ?? ""} ${r.varianceExplanation ?? ""}`}
          exportFilename="grade-reconciliation"
          exportColumns={[
            { header: t("resourceGovernance.reconciliation.periodStart"), value: (r) => r.periodStart.slice(0, 10) },
            { header: t("common.site"), value: (r) => r.site?.name ?? "" },
            { header: t("resourceGovernance.reconciliation.mineralType"), value: (r) => r.mineralType },
            { header: t("resourceGovernance.reconciliation.mcfShort"), value: (r) => (r.mineCallFactorPct != null ? String(r.mineCallFactorPct) : "") },
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
        <Modal title={formModal === "create" ? t("resourceGovernance.reconciliation.newRecordTitle") : t("resourceGovernance.reconciliation.editRecordTitle")} onClose={() => setFormModal(null)}>
          <ReconciliationForm
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
