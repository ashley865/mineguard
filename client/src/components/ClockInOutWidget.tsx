import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { MyAttendanceSummary } from "../api/types";
import Modal from "./Modal";

function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-mine-800/50 rounded-lg p-2 text-center">
      <div className="text-[10px] text-mine-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
    </div>
  );
}

function HistoryModal({ summary, onClose }: { summary: MyAttendanceSummary; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal title={t("attendance.myHoursTitle")} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatBox label={t("attendance.hoursThisWeek")} value={`${summary.stats.hoursThisWeek}h`} />
        <StatBox label={t("attendance.hoursThisMonth")} value={`${summary.stats.hoursThisMonth}h`} />
        <StatBox
          label={t("attendance.avgPerShift")}
          value={summary.stats.avgHoursPerShift != null ? `${summary.stats.avgHoursPerShift}h` : "—"}
        />
      </div>
      <div className="text-xs font-semibold text-mine-300 uppercase mb-2">{t("attendance.recentActivity")}</div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {summary.recent.length === 0 && <div className="text-mine-400 text-xs">{t("attendance.noneYet")}</div>}
        {summary.recent.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-xs border-b border-mine-800 pb-1.5">
            <span>{new Date(r.checkInAt).toLocaleString()}</span>
            <span className="text-mine-400">
              {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : t("attendance.stillClockedIn")}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function ClockInOutWidget() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<MyAttendanceSummary | null>(null);
  const [toggling, setToggling] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  async function load() {
    try {
      const res = await api.get<MyAttendanceSummary>("/attendance/me");
      setSummary(res.data);
    } catch {
      // Not authenticated yet — nothing to show.
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!summary?.open) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [summary?.open]);

  async function toggle() {
    setToggling(true);
    try {
      await api.post("/attendance/toggle");
      await load();
    } finally {
      setToggling(false);
    }
  }

  if (!summary) return null;

  const elapsedLabel = summary.open ? formatElapsed(now - new Date(summary.open.checkInAt).getTime()) : null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        disabled={toggling}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm active:scale-[0.98] transition-all disabled:opacity-60 ${
          summary.open
            ? "bg-success-600 hover:bg-success-700 text-white"
            : "bg-mine-800 hover:bg-mine-700 text-mine-100 border border-mine-700"
        }`}
      >
        {summary.open ? `${t("attendance.clockOut")} · ${elapsedLabel}` : t("attendance.clockIn")}
      </button>
      <button
        type="button"
        aria-label={t("attendance.viewHours")}
        onClick={() => setHistoryOpen(true)}
        className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-mine-300 hover:bg-mine-800 hover:text-mine-50 transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" strokeLinecap="round" />
        </svg>
      </button>
      {historyOpen && <HistoryModal summary={summary} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
