import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BalanceSheet, ExportableEntity, exportableEntities, JournalEntry, ReportTrends, Site } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "../components/ui";

const dayOptions = [30, 90, 180, 365];
type ReportingTab = "overview" | "balanceSheet" | "journal";

async function downloadReport(url: string, params: Record<string, unknown> | undefined, fallbackName: string) {
  const res = await api.get(url, { params, responseType: "blob" });
  const disposition = res.headers?.["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename="([^"]+)"/);
  const objectUrl = window.URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function RateCard({ label, numerator, denominator }: { label: string; numerator: number; denominator: number }) {
  const pct = denominator === 0 ? 100 : Math.round((numerator / denominator) * 100);
  const tone = pct >= 80 ? "text-success-500" : pct >= 50 ? "text-hazard-500" : "text-danger-500";
  return (
    <div className={`${cardClass} px-3 py-2`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${tone}`}>{pct}%</div>
      <div className="text-[10px] text-mine-400 mt-0.5">{numerator} / {denominator}</div>
    </div>
  );
}

function BalanceSheetLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? "font-bold text-sm border-t border-mine-800 mt-1 pt-2" : "text-xs text-mine-300"}`}>
      <span>{label}</span>
      <span className={bold ? "text-mine-50" : ""}>{value.toLocaleString()}</span>
    </div>
  );
}

function BalanceSheetTab() {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState<BalanceSheet | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get<BalanceSheet>("/reports/balance-sheet").then((res) => setSheet(res.data));
  }, []);

  async function download() {
    setDownloading(true);
    try {
      await downloadReport("/reports/balance-sheet/pdf", undefined, "Balance-Sheet.html");
    } finally {
      setDownloading(false);
    }
  }

  if (!sheet) return <div className="text-mine-300 text-sm">{t("common.loading")}</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-mine-400">{t("reporting.balanceSheetNote", { date: new Date(sheet.asOf).toLocaleString() })}</p>
        <button className={buttonSecondary} disabled={downloading} onClick={download}>
          {downloading ? t("reporting.downloading") : t("reporting.downloadPdf")}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`${cardClass} p-4`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mine-300 mb-2">{t("reporting.assets")}</h3>
          <BalanceSheetLine label={t("reporting.cashAndEquivalents")} value={sheet.assets.cashAndEquivalents} />
          <BalanceSheetLine label={t("reporting.accountsReceivable")} value={sheet.assets.accountsReceivable} />
          <BalanceSheetLine label={t("reporting.inventoryValue")} value={sheet.assets.inventory} />
          <BalanceSheetLine label={t("reporting.totalAssets")} value={sheet.assets.total} bold />
        </div>
        <div className={`${cardClass} p-4`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mine-300 mb-2">{t("reporting.liabilities")}</h3>
          <BalanceSheetLine label={t("reporting.accountsPayable")} value={sheet.liabilities.accountsPayable} />
          <BalanceSheetLine label={t("reporting.totalLiabilities")} value={sheet.liabilities.total} bold />
        </div>
        <div className={`${cardClass} p-4`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mine-300 mb-2">{t("reporting.equity")}</h3>
          <BalanceSheetLine label={t("reporting.retainedEarnings")} value={sheet.equity.retainedEarnings} />
          <BalanceSheetLine label={t("reporting.totalEquity")} value={sheet.equity.total} bold />
        </div>
      </div>
    </div>
  );
}

function JournalTab() {
  const { t } = useTranslation();
  const [months, setMonths] = useState(3);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setEntries(null);
    api.get<JournalEntry[]>("/reports/journal", { params: { months } }).then((res) => setEntries(res.data));
  }, [months]);

  async function download() {
    setDownloading(true);
    try {
      await downloadReport("/reports/journal/pdf", { months }, "Journal.html");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {[1, 3, 6, 12].map((m) => (
            <button key={m} className={months === m ? buttonPrimary : buttonSecondary} onClick={() => setMonths(m)}>
              {t("reporting.lastNMonths", { count: m })}
            </button>
          ))}
        </div>
        <button className={buttonSecondary} disabled={downloading} onClick={download}>
          {downloading ? t("reporting.downloading") : t("reporting.downloadPdf")}
        </button>
      </div>
      {!entries ? (
        <div className="text-mine-300 text-sm">{t("common.loading")}</div>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("reporting.journalDate")}</th>
                <th className="text-left px-4 py-2">{t("reporting.journalDescription")}</th>
                <th className="text-left px-4 py-2">{t("reporting.journalType")}</th>
                <th className="text-right px-4 py-2">{t("reporting.journalAmount")}</th>
                <th className="text-right px-4 py-2">{t("reporting.journalBalance")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 text-mine-300">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{e.description}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${e.type === "INCOME" ? "bg-success-600 text-white" : "bg-danger-500 text-white"}`}>
                      {t(`reporting.journalTypes.${e.type}`)}
                    </span>
                  </td>
                  <td className={`px-4 py-2 text-right font-semibold ${e.type === "INCOME" ? "text-success-500" : "text-danger-400"}`}>
                    {e.type === "INCOME" ? "+" : "-"}{e.currency} {e.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-mine-300">{e.currency} {e.runningBalance.toLocaleString()}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("reporting.noJournalEntries")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Reporting() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canSeeFinancials = user?.role === "ADMIN" || ["CFO", "GENERAL_MANAGER", "COO"].includes(user?.title ?? "");
  const [tab, setTab] = useState<ReportingTab>("overview");
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string>("");
  const [days, setDays] = useState(90);
  const [data, setData] = useState<ReportTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    api.get<Site[]>("/sites").then((res) => setSites(res.data));
  }, []);

  async function load() {
    setLoading(true);
    const res = await api.get<ReportTrends>("/reports/trends", {
      params: { siteId: siteId || undefined, days },
    });
    setData(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, days]);

  async function exportCsv(entity: ExportableEntity) {
    setExporting(entity);
    try {
      const res = await api.get(`/reports/export/${entity}`, {
        params: { siteId: siteId || undefined },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">{t("reporting.nav")}</h1>
        <p className="text-mine-300 text-xs">{t("reporting.subtitle")}</p>
      </div>

      {canSeeFinancials && (
        <div className="flex gap-2 flex-wrap">
          <button className={tab === "overview" ? buttonPrimary : buttonSecondary} onClick={() => setTab("overview")}>
            {t("reporting.tabOverview")}
          </button>
          <button className={tab === "balanceSheet" ? buttonPrimary : buttonSecondary} onClick={() => setTab("balanceSheet")}>
            {t("reporting.tabBalanceSheet")}
          </button>
          <button className={tab === "journal" ? buttonPrimary : buttonSecondary} onClick={() => setTab("journal")}>
            {t("reporting.tabJournal")}
          </button>
        </div>
      )}

      {tab === "balanceSheet" && canSeeFinancials && <BalanceSheetTab />}
      {tab === "journal" && canSeeFinancials && <JournalTab />}

      {tab === "overview" && (
      <>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputClass} max-w-xs`} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{t("reporting.allSites")}</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {dayOptions.map((d) => (
            <button
              key={d}
              className={days === d ? buttonPrimary : buttonSecondary}
              onClick={() => setDays(d)}
            >
              {t("reporting.lastNDays", { count: d })}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-mine-300 text-sm">{t("reporting.loading")}</div>}

      {!loading && data && (
        <>
          <div className={`${cardClass} p-3 flex items-center justify-between flex-wrap gap-3`}>
            <div>
              <h2 className="text-xs font-semibold">{t("reporting.complianceScore")}</h2>
              <p className="text-[10px] text-mine-400 mt-0.5">{t("reporting.complianceScoreNote")}</p>
            </div>
            <div
              className={`text-2xl font-bold ${
                data.complianceScore >= 80
                  ? "text-success-500"
                  : data.complianceScore >= 50
                  ? "text-hazard-500"
                  : "text-danger-500"
              }`}
            >
              {data.complianceScore}%
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
            <RateCard label={t("compliance.tabCop")} numerator={data.compliance.codesOfPractice.active} denominator={data.compliance.codesOfPractice.total} />
            <RateCard label={t("compliance.tabRisk")} numerator={data.compliance.riskAssessments.approved} denominator={data.compliance.riskAssessments.total} />
            <RateCard label={t("permits.nav")} numerator={data.compliance.permits.active} denominator={data.compliance.permits.total} />
            <RateCard label={t("compliance.tabInspections")} numerator={data.compliance.safetyInspections.completed} denominator={data.compliance.safetyInspections.total} />
            <RateCard label={t("workforce.tabCertificates")} numerator={data.compliance.certificates.active} denominator={data.compliance.certificates.total} />
            <RateCard label={t("reporting.trainingCurrent")} numerator={data.compliance.trainingRecords.total - data.compliance.trainingRecords.expiringSoon} denominator={data.compliance.trainingRecords.total} />
            <RateCard label={t("contractors.nav")} numerator={data.compliance.contractors.active} denominator={data.compliance.contractors.total} />
          </div>

          <div className={`${cardClass} p-3`}>
            <h2 className="text-xs font-semibold mb-2">{t("reporting.trendTitle")}</h2>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "#52525b" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="incidents" name={t("reporting.incidents")} stroke="#e13b2e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="alerts" name={t("reporting.alerts")} stroke="#c48a1f" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className={`${cardClass} p-3`}>
              <h2 className="text-xs font-semibold mb-2">{t("reporting.alertsBySeverity")}</h2>
              <div className="space-y-1.5">
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
                  <div key={sev} className="flex items-center justify-between text-xs">
                    <SeverityBadge severity={sev} />
                    <span className="font-semibold">{data.alertsBySeverity[sev]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${cardClass} p-3`}>
              <h2 className="text-xs font-semibold mb-2">{t("reporting.expiryForecast")}</h2>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.expiryForecast.map((f) => ({ ...f, label: t(`reporting.categories.${f.category}`) }))}>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#52525b" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#52525b" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 }} />
                    <Bar dataKey="count" fill="#c48a1f" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[10px] text-mine-400 mt-1.5">{t("reporting.expiryForecastNote")}</div>
            </div>
          </div>

          <div className={`${cardClass} p-3`}>
            <h2 className="text-xs font-semibold mb-2">{t("reporting.exportTitle")}</h2>
            <div className="flex flex-wrap gap-2">
              {exportableEntities.map((entity) => (
                <button
                  key={entity}
                  className={buttonSecondary}
                  disabled={exporting === entity}
                  onClick={() => exportCsv(entity)}
                >
                  {exporting === entity ? t("reporting.exporting") : t(`reporting.entities.${entity}`)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
