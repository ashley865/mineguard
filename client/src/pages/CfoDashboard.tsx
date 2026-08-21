import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../api/client";
import { Alert, BudgetSummary, ExecutiveSummary, Incident, Invoice, ProductionFinancialSummary, ReportTrends } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary } from "../components/ui";
import { CoinsIcon, GaugeIcon, ReceiptIcon, ClockIcon, ShieldCheckIcon } from "../components/icons/DashboardIcons";
import FinancialSummaryWidget from "../components/FinancialSummaryWidget";
import BudgetSummaryWidget from "../components/BudgetSummaryWidget";
import AiAssistantWidget from "../components/AiAssistantWidget";
import LiveDataWidget from "../components/LiveDataWidget";
import IndustryNewsWidget from "../components/IndustryNewsWidget";

// Built with the dashboard-designer skill's F-pattern, same as CooDashboard.tsx:
// a headline row of target-comparable KPIs, a supporting-detail row for the P&L and
// budget widgets, and drilldown links into Invoices/Expenses instead of duplicating
// their tables here. Per the skill's "one dashboard, one audience" rule, the CFO now
// gets a dedicated page instead of the shared ExecutiveDashboard.

type Tone = "positive" | "negative" | "caution";

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

function money(n: number) {
  return `R ${Math.round(n).toLocaleString()}`;
}

function invoiceTotal(invoice: Invoice): number {
  const subtotal = invoice.lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return subtotal * (1 + invoice.vatRate / 100);
}

function HeadlineKpi({ icon, label, value, target, tone, to }: { icon: React.ReactNode; label: string; value: string | number; target: string; tone?: Tone; to?: string }) {
  const content = (
    <>
      <div className={`w-9 h-9 rounded-[11px] flex items-center justify-center mb-4 ${TONE_BADGE[tone ?? "neutral"]}`}>{icon}</div>
      <div className={`text-[28px] font-bold leading-none tabular-nums ${toneText(tone)}`}>{value}</div>
      <div className="text-xs text-mine-300 mt-2.5">{label}</div>
      <div className="text-[10px] text-mine-500 mt-1">{target}</div>
    </>
  );
  return to ? (
    <Link to={to} className={`${cardOuter} p-6 block hover:border-hazard-500 transition-colors`}>{content}</Link>
  ) : (
    <div className={`${cardOuter} p-6`}>{content}</div>
  );
}

function RateRow({ label, numerator, denominator }: { label: string; numerator: number; denominator: number }) {
  const pct = denominator === 0 ? 100 : Math.round((numerator / denominator) * 100);
  const tone: Tone = pct >= 80 ? "positive" : pct >= 50 ? "caution" : "negative";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-mine-300">{label}</span>
      <span className={`font-semibold tabular-nums ${toneText(tone)}`}>{pct}%</span>
    </div>
  );
}

function MiniPie({ data, emptyLabel }: { data: { name: string; value: number; color: string }[]; emptyLabel: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return <div className="text-mine-400 text-xs h-32 flex items-center justify-center">{emptyLabel}</div>;
  }
  return (
    <div className="h-32 flex items-center gap-2">
      <div className="w-24 h-24 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={22} outerRadius={40} paddingAngle={2}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1 text-xs flex-1 min-w-0">
        {data.filter((d) => d.value > 0).map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-mine-300 truncate">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="font-semibold text-mine-50 tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewRow({ label, onApprove, onReject }: { label: React.ReactNode; onApprove: (note: string) => void; onReject: (note: string) => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  return (
    <div className="border border-mine-800 rounded-md p-3 space-y-2">
      {label}
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 bg-mine-800 border border-mine-700 rounded-md px-2 py-1 text-xs"
          placeholder={t("common.reviewNotePlaceholder") ?? ""}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => onApprove(note)}>{t("common.approve")}</button>
        <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => onReject(note)}>{t("common.reject")}</button>
      </div>
    </div>
  );
}

export default function CfoDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [trends, setTrends] = useState<ReportTrends | null>(null);
  const [financial, setFinancial] = useState<ProductionFinancialSummary | null>(null);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  async function load() {
    const [s, r, f, b, i] = await Promise.all([
      api.get<ExecutiveSummary>("/executive/summary"),
      api.get<ReportTrends>("/reports/trends", { params: { days: 30 } }),
      api.get<ProductionFinancialSummary>("/production/financial-summary", { params: { months: 6 } }),
      api.get<BudgetSummary>("/budget-plans/summary"),
      api.get<Invoice[]>("/invoices"),
    ]);
    setSummary(s.data);
    setTrends(r.data);
    setFinancial(f.data);
    setBudget(b.data);
    setInvoices(i.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function reviewAlert(id: string, decision: "APPROVED" | "REJECTED", note: string) {
    await api.post(`/alerts/${id}/review`, { decision, note: note || undefined });
    await load();
  }

  async function reviewIncident(id: string, decision: "APPROVED" | "REJECTED", note: string) {
    await api.post(`/incidents/${id}/review`, { decision, note: note || undefined });
    await load();
  }

  if (!summary) {
    return <div className="text-mine-300">{t("executive.loading")}</div>;
  }

  const { alertSeverity, complianceScore, pendingReviews } = summary;
  const unpaidInvoices = (invoices ?? []).filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE");
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + invoiceTotal(inv), 0);
  const overdueCount = (invoices ?? []).filter((inv) => inv.status === "OVERDUE").length;
  const netMargin = financial?.totals.netMargin ?? 0;
  const utilizationPct = budget && budget.planCount > 0 ? budget.utilizationPct : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">{t("executive.cfo.title")}</h1>
        <p className="text-mine-300 text-xs mt-0.5">
          {t("executive.cfo.briefing", { margin: money(netMargin), outstanding: money(totalOutstanding), compliance: complianceScore })}
        </p>
      </div>

      {/* Level 1 — headline KPIs, each with an explicit target */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <HeadlineKpi
          icon={<CoinsIcon />}
          label={t("production.netMargin")}
          value={money(netMargin)}
          target={t("executive.cfo.targetPositive")}
          tone={netMargin >= 0 ? "positive" : "negative"}
        />
        <HeadlineKpi
          icon={<GaugeIcon />}
          label={t("budgetPlanning.utilization")}
          value={utilizationPct == null ? "—" : `${utilizationPct}%`}
          target={t("executive.cfo.targetMaxPct", { pct: 100 })}
          tone={utilizationPct == null ? undefined : utilizationPct > 100 ? "negative" : utilizationPct > 85 ? "caution" : "positive"}
          to="/budget-planning"
        />
        <HeadlineKpi
          icon={<ReceiptIcon />}
          label={t("invoices.totalOutstanding")}
          value={money(totalOutstanding)}
          target={t("executive.cfo.targetCollect")}
          tone={overdueCount > 0 ? "caution" : "positive"}
          to="/invoices"
        />
        <HeadlineKpi
          icon={<ClockIcon />}
          label={t("invoices.overdueCount")}
          value={overdueCount}
          target={t("executive.coo.targetZero")}
          tone={overdueCount === 0 ? "positive" : "negative"}
          to="/invoices"
        />
        <HeadlineKpi
          icon={<ShieldCheckIcon />}
          label={t("executive.complianceScore")}
          value={`${complianceScore}%`}
          target={t("executive.coo.targetPct", { pct: 80 })}
          tone={complianceScore >= 80 ? "positive" : complianceScore >= 50 ? "caution" : "negative"}
        />
      </div>

      {/* Supporting detail — P&L and budget health side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FinancialSummaryWidget />
        <BudgetSummaryWidget />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/invoices" className={`${cardOuter} block hover:border-hazard-500 transition-colors flex items-center justify-between`}>
          <div>
            <h2 className="text-sm font-semibold">{t("invoices.nav")}</h2>
            <p className="text-xs text-mine-400 mt-1">{t("invoices.subtitle")}</p>
          </div>
          <span className="text-hazard-500 text-sm">→</span>
        </Link>
        <Link to="/expenses" className={`${cardOuter} block hover:border-hazard-500 transition-colors flex items-center justify-between`}>
          <div>
            <h2 className="text-sm font-semibold">{t("expenses.nav")}</h2>
            <p className="text-xs text-mine-400 mt-1">{t("expenses.subtitle")}</p>
          </div>
          <span className="text-hazard-500 text-sm">→</span>
        </Link>
      </div>

      <AiAssistantWidget showReportGenerator={false} showDepartmentReportGenerator />
      <LiveDataWidget showMineralPrices />
      <IndustryNewsWidget />

      {/* Supporting detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-3">{t("executive.openAlertsBySeverity")}</h2>
          <MiniPie
            emptyLabel={t("dashboard.noOpenAlerts")}
            data={[
              { name: t("badges.severity.CRITICAL"), value: alertSeverity.CRITICAL, color: "#e13b2e" },
              { name: t("badges.severity.HIGH"), value: alertSeverity.HIGH, color: "#f3665b" },
              { name: t("badges.severity.MEDIUM"), value: alertSeverity.MEDIUM, color: "#d9a441" },
              { name: t("badges.severity.LOW"), value: alertSeverity.LOW, color: "#8a9ab5" },
            ]}
          />
        </div>

        {trends && (
          <div className={cardOuter}>
            <h2 className="text-sm font-semibold mb-3">{t("executive.complianceBreakdown")}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <RateRow label={t("compliance.tabCop")} numerator={trends.compliance.codesOfPractice.active} denominator={trends.compliance.codesOfPractice.total} />
              <RateRow label={t("compliance.tabRisk")} numerator={trends.compliance.riskAssessments.approved} denominator={trends.compliance.riskAssessments.total} />
              <RateRow label={t("permits.nav")} numerator={trends.compliance.permits.active} denominator={trends.compliance.permits.total} />
              <RateRow label={t("contractors.nav")} numerator={trends.compliance.contractors.active} denominator={trends.compliance.contractors.total} />
            </div>
          </div>
        )}
      </div>

      <div className={cardOuter}>
        <h2 className="text-sm font-semibold mb-4">{t("executive.pendingReviews")}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-[10px] font-semibold text-mine-300 uppercase mb-1.5">{t("executive.pendingAlerts")}</h3>
            <div className="space-y-1.5">
              {pendingReviews.alerts.length === 0 && <div className="text-mine-400 text-xs">{t("executive.noPendingAlerts")}</div>}
              {pendingReviews.alerts.map((alert: Alert) => (
                <ReviewRow
                  key={alert.id}
                  label={
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={alert.severity} />
                        <span className="text-[10px] text-mine-400">{new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-xs">{alert.message}</div>
                      <div className="text-[10px] text-mine-400">
                        {alert.site?.name}
                        {alert.zone?.name ? ` · ${alert.zone.name}` : ""}
                      </div>
                    </div>
                  }
                  onApprove={(note) => reviewAlert(alert.id, "APPROVED", note)}
                  onReject={(note) => reviewAlert(alert.id, "REJECTED", note)}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold text-mine-300 uppercase mb-1.5">{t("executive.pendingIncidents")}</h3>
            <div className="space-y-1.5">
              {pendingReviews.incidents.length === 0 && <div className="text-mine-400 text-xs">{t("executive.noPendingIncidents")}</div>}
              {pendingReviews.incidents.map((incident: Incident) => (
                <ReviewRow
                  key={incident.id}
                  label={
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={incident.severity} />
                        <span className="text-[10px] text-mine-400">{new Date(incident.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-xs font-medium">{incident.title}</div>
                      <div className="text-[10px] text-mine-400">
                        {incident.site?.name}
                        {incident.zone?.name ? ` · ${incident.zone.name}` : ""}
                      </div>
                    </div>
                  }
                  onApprove={(note) => reviewIncident(incident.id, "APPROVED", note)}
                  onReject={(note) => reviewIncident(incident.id, "REJECTED", note)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
