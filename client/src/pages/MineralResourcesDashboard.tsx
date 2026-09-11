import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../api/client";
import { MineralResourcesDashboardSummary } from "../api/types";
import LoadError from "../components/LoadError";
import AiAssistantWidget from "../components/AiAssistantWidget";
import { GemIcon, LayersIcon, ClockIcon, ClipboardIcon, ShieldCheckIcon } from "../components/icons/DashboardIcons";

// Same F-pattern / dashboard-designer approach as the other department dashboards.

type Tone = "positive" | "negative" | "caution";
type QueueTab = "stale" | "competentPerson" | "assay" | "inProgress" | "registers" | "variances";

const cardOuter = "bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6";
const TONE_BADGE: Record<Tone | "neutral", string> = {
  positive: "bg-success-500/10 text-success-500",
  negative: "bg-danger-500/10 text-danger-500",
  caution: "bg-hazard-500/10 text-hazard-500",
  neutral: "bg-mine-400/10 text-mine-400",
};

function toneText(tone?: Tone) {
  return tone === "positive" ? "text-success-500" : tone === "negative" ? "text-danger-500" : tone === "caution" ? "text-hazard-500" : "text-mine-50";
}

// Confidence descends from Measured through Inferred; reserves are the economically
// mineable subset and get their own colour family so the two groups read apart at a glance.
const CLASSIFICATION_COLORS: Record<string, string> = {
  MEASURED: "#22c55e",
  INDICATED: "#3b82f6",
  INFERRED: "#8a9ab5",
  PROVED_RESERVE: "#c48a1f",
  PROBABLE_RESERVE: "#f0803c",
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "#8a9ab5",
  DRILLING: "#3b82f6",
  COMPLETED: "#22c55e",
  ABANDONED: "#e13b2e",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const gradientId = `mr-spark-${useId().replace(/:/g, "")}`;
  if (data.length < 2) return null;
  return (
    <div className="h-7 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HeadlineKpi({ icon, label, value, target, tone, trend, trendColor }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  target: string;
  tone?: Tone;
  trend?: number[];
  trendColor?: string;
}) {
  return (
    <div className={cardOuter}>
      <div className={`w-9 h-9 rounded-[11px] flex items-center justify-center mb-4 ${TONE_BADGE[tone ?? "neutral"]}`}>{icon}</div>
      <div className={`text-2xl font-bold leading-none tabular-nums truncate ${toneText(tone)}`}>{value}</div>
      <div className="text-xs text-mine-300 mt-2.5 truncate">{label}</div>
      <div className="text-[10px] text-mine-500 mt-1 truncate">{target}</div>
      {trend && trend.length >= 2 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={trend} color={trendColor ?? "#8a9ab5"} />
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-mine-300">{label}</span>
      <span className={`font-semibold tabular-nums ${toneText(tone)}`}>{value}</span>
    </div>
  );
}

export default function MineralResourcesDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<MineralResourcesDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [queueTab, setQueueTab] = useState<QueueTab>("stale");

  async function load() {
    setLoadError(false);
    try {
      const res = await api.get<MineralResourcesDashboardSummary>("/mineral-resources-dashboard/summary");
      setSummary(res.data);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loadError) return <LoadError onRetry={load} />;
  if (!summary) return <div className="text-mine-300">{t("common.loading")}</div>;

  const { headline, trends, breakdowns, drilling, grades, estimateGovernance, surveyAndBoundary, qaqc, mineralRights, gradeReconciliation, actionQueue } = summary;

  const drillingTrend = trends.drilling.map((d) => d.count);

  const classificationOrder = ["MEASURED", "INDICATED", "INFERRED", "PROVED_RESERVE", "PROBABLE_RESERVE"];
  const classificationData = classificationOrder
    .map((c) => ({ name: t(`mineralResourcesDashboard.classifications.${c}`, c), classification: c, value: breakdowns.tonnageByClassification[c] ?? 0 }))
    .filter((d) => d.value > 0);

  const statusOrder = ["PLANNED", "DRILLING", "COMPLETED", "ABANDONED"];
  const statusData = statusOrder
    .map((s) => ({ name: t(`mineralResourcesDashboard.holeStatuses.${s}`, s), status: s, value: breakdowns.holesByStatus[s] ?? 0 }))
    .filter((d) => d.value > 0);

  const queueCounts: Record<QueueTab, number> = {
    stale: actionQueue.staleEstimates.length,
    competentPerson: actionQueue.missingCompetentPerson.length,
    assay: actionQueue.holesAwaitingAssay.length,
    inProgress: actionQueue.holesInProgress.length,
    registers: actionQueue.registerLapsed.length,
    variances: actionQueue.unexplainedVariances.length,
  };
  const totalActions = Object.values(queueCounts).reduce((a, b) => a + b, 0);

  const queueTabs: { key: QueueTab; label: string }[] = [
    { key: "stale", label: t("mineralResourcesDashboard.queue.stale") },
    { key: "competentPerson", label: t("mineralResourcesDashboard.queue.competentPerson") },
    { key: "registers", label: t("mineralResourcesDashboard.queue.registers") },
    { key: "variances", label: t("mineralResourcesDashboard.queue.variances") },
    { key: "assay", label: t("mineralResourcesDashboard.queue.assay") },
    { key: "inProgress", label: t("mineralResourcesDashboard.queue.inProgress") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("mineralResourcesDashboard.title")}</h1>
        <p className="text-mine-300 text-sm">{t("mineralResourcesDashboard.subtitle")}</p>
      </div>

      {/* Level 1 — headline KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <HeadlineKpi
          icon={<GemIcon />}
          label={t("mineralResourcesDashboard.measuredIndicated")}
          value={`${headline.measuredIndicated.toLocaleString()} t`}
          target={t("mineralResourcesDashboard.inferredTarget", { tonnes: headline.inferred.toLocaleString() })}
        />
        <HeadlineKpi
          icon={<LayersIcon />}
          label={t("mineralResourcesDashboard.reserves")}
          value={`${headline.reserves.toLocaleString()} t`}
          target={t("mineralResourcesDashboard.reservesTarget")}
        />
        <HeadlineKpi
          icon={<ClockIcon />}
          label={t("mineralResourcesDashboard.reserveLife")}
          value={headline.reserveLifeYears !== null ? t("mineralResourcesDashboard.years", { count: headline.reserveLifeYears }) : "—"}
          target={
            headline.annualProduction > 0
              ? t("mineralResourcesDashboard.atCurrentRate", { tonnes: headline.annualProduction.toLocaleString() })
              : t("mineralResourcesDashboard.noProduction")
          }
          tone={headline.reserveLifeYears === null ? undefined : headline.reserveLifeYears >= 10 ? "positive" : headline.reserveLifeYears >= 5 ? "caution" : "negative"}
        />
        <HeadlineKpi
          icon={<ClipboardIcon />}
          label={t("mineralResourcesDashboard.holesAwaitingAssay")}
          value={headline.holesAwaitingAssay}
          target={t("mineralResourcesDashboard.holesInProgressTarget", { count: headline.holesInProgress })}
          tone={headline.holesAwaitingAssay > 0 ? "caution" : "positive"}
          trend={drillingTrend}
          trendColor="#3b82f6"
        />
        {/* Distinct from the estimate-governance figures below: those are resource-statement
            hygiene, this is the survey, boundary and mineral-right evidence that determines
            whether the mine is operating lawfully at all. */}
        <HeadlineKpi
          icon={<ShieldCheckIcon />}
          label={t("mineralResourcesDashboard.registerLapsed")}
          value={headline.registerLapsed}
          target={t("mineralResourcesDashboard.registerLapsedTarget")}
          tone={headline.registerLapsed > 0 ? "negative" : "positive"}
        />
      </div>

      {/* Level 2 — the resource statement is the primary artefact here, so it takes the
          wide slot rather than a time series: this is a position, not a rate. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardOuter} lg:col-span-2`}>
          <h2 className="text-sm font-semibold">{t("mineralResourcesDashboard.statementTitle")}</h2>
          <p className="text-[11px] text-mine-400 mt-0.5 mb-4">{t("mineralResourcesDashboard.statementHint")}</p>
          {classificationData.length === 0 ? (
            <div className="text-xs text-mine-400 py-12 text-center">{t("mineralResourcesDashboard.noEstimates")}</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classificationData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={110} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {classificationData.map((d) => (
                      <Cell key={d.classification} fill={CLASSIFICATION_COLORS[d.classification] ?? "#8a9ab5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("mineralResourcesDashboard.holesByStatus")}</h2>
          {statusData.length === 0 ? (
            <div className="text-xs text-mine-400 py-8 text-center">{t("mineralResourcesDashboard.noHoles")}</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={80} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {statusData.map((d) => (
                      <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "#8a9ab5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* The AI assistant is a standalone feature, not a panel: it renders its own
          hazard-bordered card, so boxing it inside a cardOuter column would double the
          border and padding and mute the styling that marks it out. */}
      <AiAssistantWidget showDepartmentReportGenerator />

      {/* Level 3 — supporting detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("mineralResourcesDashboard.drillingTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("mineralResourcesDashboard.drillingHint")}</p>
          </div>
          <StatRow label={t("mineralResourcesDashboard.totalHoles")} value={drilling.totalHoles} />
          <StatRow label={t("mineralResourcesDashboard.completedHoles")} value={drilling.completedHoles} />
          <StatRow label={t("mineralResourcesDashboard.metresDrilled")} value={drilling.metresDrilled.toLocaleString()} />
          <StatRow label={t("mineralResourcesDashboard.assayIntervals")} value={drilling.assayIntervals.toLocaleString()} />
          {grades.length > 0 && (
            <div className="border-t border-mine-800 pt-3 space-y-3">
              <div className="text-[11px] text-mine-400">{t("mineralResourcesDashboard.gradesHint")}</div>
              {grades.map((g) => (
                <StatRow
                  key={g.mineralType}
                  label={t(`mineralResourcesDashboard.minerals.${g.mineralType}`, g.mineralType)}
                  value={`${g.grade}${g.unit ? ` ${g.unit}` : ""}`}
                />
              ))}
            </div>
          )}
          <div className="pt-2">
            <Link to="/geology" className="text-xs text-hazard-500 hover:underline">{t("mineralResourcesDashboard.openGeology")}</Link>
          </div>
        </div>

        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("mineralResourcesDashboard.governanceTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("mineralResourcesDashboard.governanceHint")}</p>
          </div>
          <StatRow label={t("mineralResourcesDashboard.currentEstimates")} value={estimateGovernance.currentEstimates} />
          <StatRow label={t("mineralResourcesDashboard.supersededVersions")} value={estimateGovernance.supersededVersions} />
          <StatRow
            label={t("mineralResourcesDashboard.staleEstimates")}
            value={estimateGovernance.staleEstimates}
            tone={estimateGovernance.staleEstimates > 0 ? "caution" : "positive"}
          />
          <StatRow
            label={t("mineralResourcesDashboard.missingCompetentPerson")}
            value={estimateGovernance.missingCompetentPerson}
            tone={estimateGovernance.missingCompetentPerson > 0 ? "negative" : "positive"}
          />
          <div className="pt-2">
            <Link to="/production" className="text-xs text-hazard-500 hover:underline">{t("mineralResourcesDashboard.openProduction")}</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("mineralResourcesDashboard.registersTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("mineralResourcesDashboard.registersHint")}</p>
          </div>
          <StatRow
            label={t("mineralResourcesDashboard.sitesWithoutSurvey", { count: surveyAndBoundary.sitesTracked })}
            value={surveyAndBoundary.sitesWithoutCurrentSurvey}
            tone={surveyAndBoundary.sitesWithoutCurrentSurvey > 0 ? "negative" : "positive"}
          />
          <StatRow
            label={t("mineralResourcesDashboard.beaconIssues", { count: surveyAndBoundary.beaconsTracked })}
            value={surveyAndBoundary.beaconsWithIssue}
            tone={surveyAndBoundary.beaconsWithIssue > 0 ? "negative" : "positive"}
          />
          <StatRow
            label={t("mineralResourcesDashboard.renewalOverdue")}
            value={mineralRights.renewalOverdue}
            tone={mineralRights.renewalOverdue > 0 ? "negative" : "positive"}
          />
          <div className="border-t border-mine-800 pt-3 space-y-3">
            <StatRow
              label={t("mineralResourcesDashboard.qaqcPassRate", { days: 30 })}
              value={qaqc.passRatePct !== null ? `${qaqc.passRatePct}%` : "—"}
              tone={qaqc.passRatePct === null ? undefined : qaqc.passRatePct >= 95 ? "positive" : qaqc.passRatePct >= 85 ? "caution" : "negative"}
            />
            <StatRow
              label={t("mineralResourcesDashboard.qaqcTypesCovered")}
              value={t("mineralResourcesDashboard.qaqcTypesCoveredValue", { count: qaqc.sampleTypesCovered })}
              tone={qaqc.sampleTypesCovered >= 4 ? "positive" : "caution"}
            />
          </div>
          <div className="pt-2">
            <Link to="/resource-governance" className="text-xs text-hazard-500 hover:underline">{t("mineralResourcesDashboard.openResourceGovernance")}</Link>
          </div>
        </div>

        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("mineralResourcesDashboard.reconciliationTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("mineralResourcesDashboard.reconciliationHint")}</p>
          </div>
          <StatRow
            label={t("mineralResourcesDashboard.avgMcf")}
            value={gradeReconciliation.avgMineCallFactorPct !== null ? `${gradeReconciliation.avgMineCallFactorPct}%` : "—"}
            tone={
              gradeReconciliation.avgMineCallFactorPct === null
                ? undefined
                : Math.abs(gradeReconciliation.avgMineCallFactorPct - 100) <= 10
                  ? "positive"
                  : "negative"
            }
          />
          <StatRow
            label={t("mineralResourcesDashboard.unexplainedVariances")}
            value={gradeReconciliation.unexplainedVariances}
            tone={gradeReconciliation.unexplainedVariances > 0 ? "negative" : "positive"}
          />
          <StatRow
            label={t("mineralResourcesDashboard.periodsAwaitingActuals")}
            value={gradeReconciliation.periodsAwaitingActuals}
            tone={gradeReconciliation.periodsAwaitingActuals > 0 ? "caution" : "positive"}
          />
          <div className="border-t border-mine-800 pt-3">
            <StatRow label={t("mineralResourcesDashboard.periodsRecorded")} value={gradeReconciliation.periodsRecorded} />
          </div>
          <div className="pt-2">
            <Link to="/resource-governance?tab=reconciliation" className="text-xs text-hazard-500 hover:underline">{t("mineralResourcesDashboard.openReconciliation")}</Link>
          </div>
        </div>
      </div>

      {/* Action queue — tabbed rather than four stacked tables */}
      <div className={cardOuter}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">{t("mineralResourcesDashboard.actionQueueTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">
              {totalActions === 0
                ? t("mineralResourcesDashboard.actionQueueClear")
                : t("mineralResourcesDashboard.actionQueueCount", { count: totalActions })}
            </p>
          </div>
          <Link to="/geology" className="text-xs text-hazard-500 hover:underline">{t("mineralResourcesDashboard.openModule")}</Link>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {queueTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setQueueTab(tab.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                queueTab === tab.key ? "bg-hazard-500 text-white" : "bg-mine-800/60 text-mine-300 hover:text-mine-50"
              }`}
            >
              {tab.label} ({queueCounts[tab.key]})
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {queueTab === "stale" &&
            (actionQueue.staleEstimates.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("mineralResourcesDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.staleEstimates.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">
                      {t(`mineralResourcesDashboard.minerals.${e.mineralType}`, e.mineralType)} ·{" "}
                      {t(`mineralResourcesDashboard.classifications.${e.classification}`, e.classification)}
                    </div>
                    <div className="text-mine-500 text-[11px]">
                      {e.siteName} · {t("mineralResourcesDashboard.version", { version: e.version })}
                    </div>
                  </div>
                  <span className="text-hazard-500 tabular-nums shrink-0">{new Date(e.estimateDate).toLocaleDateString()}</span>
                </div>
              ))
            ))}

          {queueTab === "competentPerson" &&
            (actionQueue.missingCompetentPerson.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("mineralResourcesDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.missingCompetentPerson.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">
                      {t(`mineralResourcesDashboard.minerals.${e.mineralType}`, e.mineralType)} ·{" "}
                      {t(`mineralResourcesDashboard.classifications.${e.classification}`, e.classification)}
                    </div>
                    <div className="text-mine-500 text-[11px]">{e.siteName}</div>
                  </div>
                  <span className="text-mine-400 shrink-0">{e.reportReference ?? t("mineralResourcesDashboard.noReport")}</span>
                </div>
              ))
            ))}

          {queueTab === "registers" &&
            (actionQueue.registerLapsed.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("mineralResourcesDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.registerLapsed.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{r.identifier}</div>
                    <div className="text-mine-500 text-[11px]">
                      {t(`mineralResourcesDashboard.registers.${r.register}`)} · {t(`mineralResourcesDashboard.registerIssues.${r.issue}`)}
                    </div>
                  </div>
                  <span className="text-danger-500 tabular-nums shrink-0">
                    {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : t("mineralResourcesDashboard.noDueDate")}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "variances" &&
            (actionQueue.unexplainedVariances.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("mineralResourcesDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.unexplainedVariances.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{v.siteName} · {t(`mineralResourcesDashboard.minerals.${v.mineralType}`, v.mineralType)}</div>
                    <div className="text-mine-500 text-[11px]">
                      {new Date(v.periodStart).toLocaleDateString()} – {new Date(v.periodEnd).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="text-danger-500 font-semibold tabular-nums shrink-0">{v.mcf}%</span>
                </div>
              ))
            ))}

          {queueTab === "assay" &&
            (actionQueue.holesAwaitingAssay.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("mineralResourcesDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.holesAwaitingAssay.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{h.holeId}</div>
                    <div className="text-mine-500 text-[11px]">
                      {h.totalDepth !== null ? t("mineralResourcesDashboard.depth", { depth: h.totalDepth }) : "—"}
                      {h.contractor ? ` · ${h.contractor}` : ""}
                    </div>
                  </div>
                  <span className="text-mine-400 tabular-nums shrink-0">
                    {h.drilledDate ? new Date(h.drilledDate).toLocaleDateString() : "—"}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "inProgress" &&
            (actionQueue.holesInProgress.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("mineralResourcesDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.holesInProgress.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{h.holeId}</div>
                    {h.contractor && <div className="text-mine-500 text-[11px]">{h.contractor}</div>}
                  </div>
                  <span className="text-mine-400 shrink-0">{t(`mineralResourcesDashboard.holeStatuses.${h.status}`, h.status)}</span>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
