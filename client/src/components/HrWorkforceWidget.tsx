import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { BceaComplianceReport, HrWorkforceSnapshot } from "../api/types";
import { SeverityBadge } from "./Badges";

type Tone = "positive" | "negative" | "caution" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  positive: "text-success-500",
  negative: "text-danger-500",
  caution: "text-hazard-500",
  neutral: "text-mine-50",
};

const TONE_BADGE_BG: Record<Tone, string> = {
  positive: "bg-success-500/10",
  negative: "bg-danger-500/10",
  caution: "bg-hazard-500/10",
  neutral: "bg-mine-400/10",
};

const TONE_STROKE: Record<Tone, string> = {
  positive: "#16a34a",
  negative: "#e13b2e",
  caution: "#c48a1f",
  neutral: "#5b7092",
};

const cardOuter = "bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6";

function barColor(pct: number) {
  if (pct >= 80) return "#16a34a";
  if (pct >= 50) return "#c48a1f";
  return "#e13b2e";
}

function toneOf(pct: number): Tone {
  if (pct >= 80) return "positive";
  if (pct >= 50) return "caution";
  return "negative";
}

function UsersIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function AlertTriangleIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function IconStatCard({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string | number; tone?: Tone }) {
  return (
    <div className={`${cardOuter} p-[22px]`}>
      <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center mb-3.5 ${TONE_BADGE_BG[tone]}`}>{icon}</div>
      <div className={`text-lg font-bold leading-none truncate ${TONE_TEXT[tone]}`}>{value}</div>
      <div className="text-xs text-mine-400 mt-2">{label}</div>
    </div>
  );
}

function BarRow({ label, pct, sublabel }: { label: string; pct: number; sublabel: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-40 text-xs text-mine-300 shrink-0 truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-mine-800 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor(pct) }} />
      </div>
      <div className="w-24 text-xs text-mine-400 text-right shrink-0">{sublabel}</div>
    </div>
  );
}

function CompletionRing({ pct }: { pct: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div className="relative w-[124px] h-[124px]">
      <svg width="124" height="124" viewBox="0 0 124 124">
        <circle cx="62" cy="62" r={r} fill="none" stroke="#eef1f6" strokeWidth="13" />
        <circle
          cx="62"
          cy="62"
          r={r}
          fill="none"
          stroke={barColor(pct)}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 62 62)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-mine-50">{pct}%</div>
    </div>
  );
}

export default function HrWorkforceWidget() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<HrWorkforceSnapshot | null>(null);
  const [bcea, setBcea] = useState<BceaComplianceReport | null>(null);

  useEffect(() => {
    api.get<HrWorkforceSnapshot>("/executive/hr-workforce").then((res) => setSnapshot(res.data)).catch(() => {});
    api.get<BceaComplianceReport>("/payroll/bcea-compliance").then((res) => setBcea(res.data)).catch(() => {});
  }, []);

  if (!snapshot) return null;

  const training = snapshot.training ?? { totalEnrollments: 0, completionPct: 0, byCourse: [] };
  const recruitment = snapshot.recruitment ?? { openRequisitions: 0, activeCandidates: 0, pendingOnboarding: 0 };
  const newHires = snapshot.newHires ?? [];
  const workerWarnings = snapshot.workerWarnings ?? [];
  const byCategory = snapshot.byCategory ?? [];
  const bceaHasBreaches = !!bcea && bcea.breaches.length > 0;

  return (
    <>
    {/* Workforce snapshot */}
    <div className={cardOuter}>
      <h2 className="text-sm font-semibold mb-5">{t("executive.hrWorkforceTitle")}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <IconStatCard
          icon={<UsersIcon color={TONE_STROKE[snapshot.onShiftPct >= 60 ? "positive" : "caution"]} />}
          label={t("executive.onShiftNow")}
          value={`${snapshot.onShiftPct}%`}
          tone={snapshot.onShiftPct >= 60 ? "positive" : "caution"}
        />
        <IconStatCard icon={<UsersIcon color={TONE_STROKE.neutral} />} label={t("executive.totalWorkers")} value={snapshot.totalWorkers} />
        <IconStatCard
          icon={<CalendarIcon color={TONE_STROKE[snapshot.pendingLeaveRequests > 0 ? "caution" : "positive"]} />}
          label={t("executive.pendingLeaveRequests")}
          value={snapshot.pendingLeaveRequests}
          tone={snapshot.pendingLeaveRequests > 0 ? "caution" : "positive"}
        />
        <IconStatCard
          icon={<ClockIcon color={TONE_STROKE[snapshot.onLeaveToday > 0 ? "caution" : "positive"]} />}
          label={t("executive.spotsToFillToday")}
          value={snapshot.onLeaveToday}
          tone={snapshot.onLeaveToday > 0 ? "caution" : "positive"}
        />
      </div>
      {byCategory.length > 0 && (
        <>
          <div className="text-sm font-semibold mb-5">{t("executive.onShiftByCategory")}</div>
          <div className="flex flex-col gap-4">
            {byCategory.map((c) => (
              <BarRow
                key={c.category}
                label={t(`workers.categories.${c.category}`)}
                pct={c.onShiftPct}
                sublabel={`${c.onShiftPct}% · ${c.onShift}/${c.total}`}
              />
            ))}
          </div>
        </>
      )}
    </div>

    {/* Training & Recruitment */}
    <div className={cardOuter}>
      <h2 className="text-sm font-semibold mb-6">{t("executive.trainingRecruitmentTitle")}</h2>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
        <div className="flex flex-col items-center text-center">
          {training.totalEnrollments === 0 ? (
            <div className="h-[124px] flex items-center justify-center text-mine-400 text-xs">—</div>
          ) : (
            <CompletionRing pct={training.completionPct} />
          )}
          <div className="text-xs text-mine-300 mt-4">{t("executive.trainingCompletionRate")}</div>
          <div className="text-[11px] text-mine-400 mt-0.5">
            {training.totalEnrollments === 0 ? "—" : `${Math.round((training.completionPct / 100) * training.totalEnrollments)} / ${training.totalEnrollments}`}
          </div>
        </div>

        <div>
          {training.byCourse.length > 0 && (
            <div className="flex flex-col gap-2.5 mb-6">
              {training.byCourse.map((c) => (
                <div key={c.courseName} className="flex items-center gap-3">
                  <div className="w-40 text-xs text-mine-300 shrink-0 truncate">{c.courseName}</div>
                  <div className="flex-1 h-1.5 rounded-full bg-mine-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.completionPct}%`, background: barColor(c.completionPct) }} />
                  </div>
                  <div className="w-9 text-xs text-mine-400 text-right shrink-0">{c.completionPct}%</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="border border-mine-800 rounded-[14px] p-3.5">
              <div className="text-xl font-bold">{recruitment.openRequisitions}</div>
              <div className="text-[11px] text-mine-400 mt-1">{t("executive.openRequisitions")}</div>
            </div>
            <div className="border border-mine-800 rounded-[14px] p-3.5">
              <div className="text-xl font-bold">{recruitment.activeCandidates}</div>
              <div className="text-[11px] text-mine-400 mt-1">{t("executive.activeCandidates")}</div>
            </div>
            <div className="border border-mine-800 rounded-[14px] p-3.5">
              <div className="text-xl font-bold">{recruitment.pendingOnboarding}</div>
              <div className="text-[11px] text-mine-400 mt-1">{t("executive.pendingOnboarding")}</div>
            </div>
          </div>

          {bceaHasBreaches ? (
            <div className="flex items-center gap-2.5 mt-4 px-3.5 py-3 rounded-xl bg-danger-500/10">
              <AlertTriangleIcon color={TONE_STROKE.negative} />
              <div className="text-xs text-danger-500 font-semibold">{t("executive.bceaBreachCount", { count: bcea!.breaches.length })}</div>
              <Link to="/payroll" className="ml-auto text-xs font-medium text-mine-300 hover:text-mine-50 transition-colors shrink-0">
                {t("executive.viewPayroll")}
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-mine-800">
              <div className="text-xs text-mine-400">{bcea ? t("executive.bceaNoBreaches") : "—"}</div>
              <Link to="/payroll" className="text-xs font-medium text-mine-300 hover:text-mine-50 transition-colors shrink-0">
                {t("executive.viewPayroll")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* New Hires + Worker Warnings */}
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
      <div className={cardOuter}>
        <h2 className="text-sm font-semibold mb-5">{t("executive.newHiresTitle")}</h2>
        {newHires.length === 0 ? (
          <div className="text-mine-400 text-xs">{t("executive.noNewHires")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-mine-400 border-b border-mine-800">
                  <th className="text-left pb-2.5">{t("workers.colName")}</th>
                  <th className="text-left pb-2.5">{t("workers.colRole")}</th>
                  <th className="text-left pb-2.5">{t("workers.colSiteZone")}</th>
                  <th className="text-left pb-2.5">{t("workers.manager")}</th>
                  <th className="text-right pb-2.5">{t("executive.hiredOn")}</th>
                </tr>
              </thead>
              <tbody>
                {newHires.map((h) => (
                  <tr key={h.id} className="border-t border-mine-900/60">
                    <td className="py-3.5 font-semibold">{h.name}</td>
                    <td className="py-3.5 text-mine-300">{h.role}</td>
                    <td className="py-3.5 text-mine-300">{h.site?.name ?? "—"}</td>
                    <td className="py-3.5 text-mine-300">{h.manager?.name ?? t("workers.noManager")}</td>
                    <td className="py-3.5 text-mine-400 text-right">{new Date(h.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={cardOuter}>
        <h2 className="text-sm font-semibold mb-5">{t("executive.workerWarningsTitle")}</h2>
        {workerWarnings.length === 0 ? (
          <div className="text-mine-400 text-xs">{t("executive.noWorkerWarnings")}</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {workerWarnings.map((w) => (
              <div key={w.id} className="rounded-[14px] border border-mine-800 p-3.5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <SeverityBadge severity={w.severity} />
                    <span className="text-xs font-semibold truncate">{w.workerName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {w.phone && (
                      <a href={`tel:${w.phone}`} className="text-xs font-medium text-hazard-400 hover:text-hazard-500 transition-colors">
                        {t("executive.contactWorker")}
                      </a>
                    )}
                    <Link to="/workers" className="text-xs font-medium text-mine-300 hover:text-mine-50 transition-colors">
                      {t("workers.viewProfile")}
                    </Link>
                  </div>
                </div>
                <div className="text-xs text-mine-400">{w.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </>
  );
}
