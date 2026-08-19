import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { DutyLogEntry, GuardPerformance, GuardSummary, PatrolAssignment, PatrolObservation, PatrolRoute, Site, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";

type SubTab = "routes" | "assignments" | "guards" | "performance" | "dutyLog" | "observations";
const PERFORMANCE_WINDOWS = [7, 30, 90] as const;

// Averages only over guards with at least one due/measurable shift in the window — a guard
// with no data yet (completionRate: null) shouldn't drag the mine-wide average toward 0.
function avgOf(values: (number | null)[]): number {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return 0;
  return Math.round((present.reduce((sum, v) => sum + v, 0) / present.length) * 10) / 10;
}

const SUGGESTED_CHECKPOINTS = [
  "Gate 1",
  "Warehouse",
  "Plant",
  "Fuel Station",
  "Main Gate",
  "Perimeter Fence",
  "Explosives Magazine",
  "Control Room",
  "Parking Area",
  "Processing Plant",
  "Tailings Dam",
  "Site Office",
  "Workshop",
  "Weighbridge",
  "Ore Stockpile",
  "Server Room",
];

function RouteForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: Partial<PatrolRoute>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [checkpoints, setCheckpoints] = useState<string[]>(
    initial?.checkpoints?.length ? initial.checkpoints.map((c) => c.name) : ["Gate 1", "Warehouse", "Plant", "Fuel Station", "Gate 1"]
  );
  const [newCheckpoint, setNewCheckpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCheckpoint(name: string) {
    if (!name.trim()) return;
    setCheckpoints((c) => [...c, name.trim()]);
    setNewCheckpoint("");
  }

  function removeCheckpoint(index: number) {
    setCheckpoints((c) => c.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setCheckpoints((c) => {
      const next = [...c];
      const target = index + dir;
      if (target < 0 || target >= next.length) return c;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (checkpoints.length === 0) {
      setError(t("patrol.routes.needCheckpoints"));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        name,
        description: description || null,
        isActive,
        checkpoints: checkpoints.map((c) => ({ name: c })),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("patrol.routes.name")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-mine-200">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {t("patrol.routes.isActive")}
      </label>

      <div>
        <label className={labelClass}>{t("patrol.routes.checkpoints")}</label>
        <div className="space-y-1.5">
          {checkpoints.map((cp, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-mine-700 text-mine-200 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="flex-1 text-sm text-mine-100">{cp}</span>
              <button type="button" className="text-xs text-mine-400 hover:text-mine-50" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="text-xs text-mine-400 hover:text-mine-50" onClick={() => move(i, 1)} disabled={i === checkpoints.length - 1}>↓</button>
              <button type="button" className="text-xs text-danger-500" onClick={() => removeCheckpoint(i)}>{t("common.delete")}</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            className={inputClass}
            value={newCheckpoint}
            onChange={(e) => setNewCheckpoint(e.target.value)}
            placeholder={t("patrol.routes.addCheckpointPlaceholder") ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCheckpoint(newCheckpoint);
              }
            }}
          />
          <button type="button" className={buttonSecondary} onClick={() => addCheckpoint(newCheckpoint)}>{t("common.add")}</button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SUGGESTED_CHECKPOINTS.map((s) => (
            <button
              key={s}
              type="button"
              className="text-[11px] px-2 py-0.5 rounded-full border border-mine-700 text-mine-300 hover:border-mine-500 hover:text-mine-50"
              onClick={() => addCheckpoint(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function AssignmentForm({ sites, routes, guards, onSubmit, onCancel }: {
  sites: Site[];
  routes: PatrolRoute[];
  guards: Worker[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const routesForSite = routes.filter((r) => r.siteId === siteId && r.isActive);
  const guardsForSite = guards.filter((g) => g.siteId === siteId);
  const [routeId, setRouteId] = useState(routesForSite[0]?.id ?? "");
  const [workerId, setWorkerId] = useState(guardsForSite[0]?.id ?? "");
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!routeId || !workerId) {
      setError(t("patrol.assignments.selectRouteAndGuard"));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ siteId, routeId, workerId, shiftDate, notes: notes || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("common.site")}</label>
        <select
          className={selectClass}
          value={siteId}
          onChange={(e) => { setSiteId(e.target.value); setRouteId(""); setWorkerId(""); }}
        >
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("patrol.assignments.route")}</label>
          <select className={selectClass} value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">{t("patrol.assignments.selectRoute")}</option>
            {routesForSite.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("patrol.assignments.guard")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <option value="">{t("patrol.assignments.selectGuard")}</option>
            {guardsForSite.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {guardsForSite.length === 0 && <p className="text-xs text-mine-400 mt-1">{t("patrol.assignments.noGuardsAtSite")}</p>}
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("patrol.assignments.shiftDate")}</label>
        <DateField value={shiftDate} onChange={setShiftDate} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ScheduleGenerateForm({ sites, routes, guards, onSubmit, onCancel }: {
  sites: Site[];
  routes: PatrolRoute[];
  guards: Worker[];
  onSubmit: (data: any) => Promise<{ created: number; skipped: number }>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const routesForSite = routes.filter((r) => r.siteId === siteId && r.isActive);
  const guardsForSite = guards.filter((g) => g.siteId === siteId);
  const [routeIds, setRouteIds] = useState<string[]>([]);
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState("7");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (routeIds.length === 0 || workerIds.length === 0) {
      setError(t("patrol.schedule.selectAtLeastOne"));
      return;
    }
    setSaving(true);
    try {
      const res = await onSubmit({ siteId, routeIds, workerIds, startDate, days: Number(days) });
      setResult(res);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-mine-200">{t("patrol.schedule.resultSummary", { created: result.created, skipped: result.skipped })}</p>
        <div className="flex justify-end pt-2">
          <button className={buttonPrimary} onClick={onCancel}>{t("common.close")}</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("patrol.schedule.hint")}</p>
      <div>
        <label className={labelClass}>{t("common.site")}</label>
        <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setRouteIds([]); setWorkerIds([]); }}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("patrol.schedule.startDate")}</label>
          <DateField value={startDate} onChange={setStartDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("patrol.schedule.days")}</label>
          <input className={inputClass} type="number" min="1" max="31" value={days} onChange={(e) => setDays(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("patrol.assignments.route")}</label>
        <div className="flex flex-wrap gap-2">
          {routesForSite.map((r) => (
            <label key={r.id} className="flex items-center gap-1.5 text-xs border border-mine-700 rounded-full px-2.5 py-1">
              <input type="checkbox" checked={routeIds.includes(r.id)} onChange={() => toggle(routeIds, setRouteIds, r.id)} />
              {r.name}
            </label>
          ))}
          {routesForSite.length === 0 && <p className="text-xs text-mine-400">{t("patrol.schedule.noRoutesAtSite")}</p>}
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("patrol.assignments.guard")}</label>
        <div className="flex flex-wrap gap-2">
          {guardsForSite.map((g) => (
            <label key={g.id} className="flex items-center gap-1.5 text-xs border border-mine-700 rounded-full px-2.5 py-1">
              <input type="checkbox" checked={workerIds.includes(g.id)} onChange={() => toggle(workerIds, setWorkerIds, g.id)} />
              {g.name}
            </label>
          ))}
          {guardsForSite.length === 0 && <p className="text-xs text-mine-400">{t("patrol.assignments.noGuardsAtSite")}</p>}
        </div>
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("patrol.schedule.generate")}</button>
      </div>
    </form>
  );
}

export default function PatrolManagementTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [subTab, setSubTab] = useState<SubTab>("routes");
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [assignments, setAssignments] = useState<PatrolAssignment[]>([]);
  const [guards, setGuards] = useState<Worker[]>([]);
  const [guardSummaries, setGuardSummaries] = useState<GuardSummary[]>([]);
  const [dutyLog, setDutyLog] = useState<DutyLogEntry[]>([]);
  const [observations, setObservations] = useState<PatrolObservation[]>([]);
  const [performance, setPerformance] = useState<GuardPerformance[]>([]);
  const [performanceDays, setPerformanceDays] = useState<number>(30);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [routeModal, setRouteModal] = useState<null | "create" | PatrolRoute>(null);
  const [assignmentModal, setAssignmentModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [copiedSiteId, setCopiedSiteId] = useState<string | null>(null);
  const [copiedGuardId, setCopiedGuardId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    // Settled rather than Promise.all: a failure fetching one section (e.g. the guard
    // duty log) must not leave every other section — routes, assignments — stuck on a
    // permanent loading spinner just because one request rejected.
    const [r, a, g, gs, dl, ob] = await Promise.allSettled([
      api.get<PatrolRoute[]>("/patrol/routes"),
      api.get<PatrolAssignment[]>("/patrol/assignments"),
      api.get<Worker[]>("/workers", { params: { category: "SECURITY" } }),
      api.get<GuardSummary[]>("/patrol/guards"),
      api.get<DutyLogEntry[]>("/patrol/duty-log"),
      api.get<PatrolObservation[]>("/patrol/observations"),
    ]);
    if (r.status === "fulfilled") setRoutes(r.value.data);
    if (a.status === "fulfilled") setAssignments(a.value.data);
    if (g.status === "fulfilled") setGuards(g.value.data);
    if (gs.status === "fulfilled") setGuardSummaries(gs.value.data);
    if (dl.status === "fulfilled") setDutyLog(dl.value.data);
    if (ob.status === "fulfilled") setObservations(ob.value.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function loadPerformance() {
    setPerformanceLoading(true);
    try {
      const res = await api.get<{ days: number; results: GuardPerformance[] }>("/patrol/guards/performance", {
        params: { days: performanceDays },
      });
      setPerformance(res.data.results);
    } finally {
      setPerformanceLoading(false);
    }
  }

  useEffect(() => {
    if (subTab === "performance") loadPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, performanceDays]);

  async function createRoute(data: any) {
    await api.post("/patrol/routes", data);
    setRouteModal(null);
    await load();
  }

  async function updateRoute(id: string, data: any) {
    await api.put(`/patrol/routes/${id}`, data);
    setRouteModal(null);
    await load();
  }

  async function removeRoute(id: string) {
    if (!confirm(t("patrol.routes.confirmDelete"))) return;
    await api.delete(`/patrol/routes/${id}`);
    await load();
  }

  async function createAssignment(data: any) {
    await api.post("/patrol/assignments", data);
    setAssignmentModal(false);
    await load();
  }

  async function removeAssignment(id: string) {
    if (!confirm(t("patrol.assignments.confirmDelete"))) return;
    await api.delete(`/patrol/assignments/${id}`);
    await load();
  }

  function copyDutyLink(siteId: string) {
    const url = `${window.location.origin}/patrol/${siteId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedSiteId(siteId);
      setTimeout(() => setCopiedSiteId(null), 2000);
    });
  }

  async function generateGuardLink(workerId: string) {
    const res = await api.post(`/patrol/guards/${workerId}/duty-link`);
    const url = `${window.location.origin}/patrol/g/${res.data.dutyToken}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedGuardId(workerId);
      setTimeout(() => setCopiedGuardId(null), 2000);
    });
    await load();
  }

  async function revokeGuardLink(workerId: string) {
    if (!confirm(t("patrol.guards.confirmRevoke"))) return;
    await api.delete(`/patrol/guards/${workerId}/duty-link`);
    await load();
  }

  async function generateSchedule(data: any) {
    const res = await api.post("/patrol/schedule/generate", data);
    await load();
    return res.data;
  }

  const performanceColumns: DataTableColumn<GuardPerformance>[] = [
    {
      key: "guard",
      header: t("patrol.guards.colGuard"),
      render: (p) => <>{p.name}<div className="text-[10px] text-mine-400">{p.site?.name}</div></>,
      sortValue: (p) => p.name,
    },
    {
      key: "completionRate",
      header: t("patrol.performance.completionRate"),
      render: (p) => (p.completionRate == null ? "—" : <span className={p.completionRate < 80 ? "text-danger-500 font-semibold" : "text-success-500"}>{p.completionRate}%</span>),
      sortValue: (p) => p.completionRate ?? -1,
    },
    {
      key: "checkpointCompliance",
      header: t("patrol.performance.checkpointCompliance"),
      render: (p) => (p.checkpointComplianceRate == null ? "—" : `${p.checkpointComplianceRate}%`),
      sortValue: (p) => p.checkpointComplianceRate ?? -1,
    },
    {
      key: "avgDuration",
      header: t("patrol.performance.avgDuration"),
      render: (p) => (p.avgPatrolDurationMinutes == null ? "—" : t("patrol.performance.minutes", { count: p.avgPatrolDurationMinutes })),
      sortValue: (p) => p.avgPatrolDurationMinutes ?? -1,
    },
    {
      key: "missed",
      header: t("patrol.performance.missedShifts"),
      render: (p) => (p.missedAssignments > 0 ? <span className="text-danger-500 font-semibold">{p.missedAssignments}</span> : "0"),
      sortValue: (p) => p.missedAssignments,
    },
    {
      key: "observations",
      header: t("patrol.performance.observations"),
      render: (p) => p.observationsLogged,
      sortValue: (p) => p.observationsLogged,
    },
    {
      key: "dutyHours",
      header: t("patrol.performance.dutyHours"),
      render: (p) => p.dutyHours,
      sortValue: (p) => p.dutyHours,
    },
    {
      key: "lastActive",
      header: t("patrol.performance.lastActive"),
      render: (p) => (p.lastActiveAt ? new Date(p.lastActiveAt).toLocaleString() : "—"),
      sortValue: (p) => p.lastActiveAt ?? "",
    },
  ];

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("patrol.subtitle")}</p>

      <div className={`${cardClass} p-4 space-y-2`}>
        <div className="text-xs font-semibold text-mine-300 uppercase">{t("patrol.dutyLinkTitle")}</div>
        <p className="text-xs text-mine-400">{t("patrol.dutyLinkHint")}</p>
        <div className="flex flex-wrap gap-2">
          {sites.map((s) => (
            <button key={s.id} className={`${buttonSecondary} text-xs px-3 py-1.5`} onClick={() => copyDutyLink(s.id)}>
              {copiedSiteId === s.id ? t("patrol.linkCopied") : t("patrol.copyLinkFor", { site: s.name })}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={subTab === "routes" ? buttonPrimary : buttonSecondary} onClick={() => setSubTab("routes")}>
          {t("patrol.tabRoutes")}
        </button>
        <button className={subTab === "assignments" ? buttonPrimary : buttonSecondary} onClick={() => setSubTab("assignments")}>
          {t("patrol.tabAssignments")}
        </button>
        <button className={subTab === "guards" ? buttonPrimary : buttonSecondary} onClick={() => setSubTab("guards")}>
          {t("patrol.tabGuards")}
        </button>
        <button className={subTab === "performance" ? buttonPrimary : buttonSecondary} onClick={() => setSubTab("performance")}>
          {t("patrol.tabPerformance")}
        </button>
        <button className={subTab === "dutyLog" ? buttonPrimary : buttonSecondary} onClick={() => setSubTab("dutyLog")}>
          {t("patrol.tabDutyLog")}
        </button>
        <button className={subTab === "observations" ? buttonPrimary : buttonSecondary} onClick={() => setSubTab("observations")}>
          {t("patrol.tabObservations")}
        </button>
      </div>

      {subTab === "routes" && (
        <div className="space-y-3">
          {canEdit && sites.length > 0 && (
            <div className="flex justify-end">
              <button className={buttonPrimary} onClick={() => setRouteModal("create")}>{t("patrol.routes.new")}</button>
            </div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("patrol.routes.name")}</th>
                  <th className="text-left px-4 py-2">{t("common.site")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.routes.checkpoints")}</th>
                  <th className="text-left px-4 py-2">{t("common.status")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-mine-300">{r.site?.name}</td>
                    <td className="px-4 py-2 text-mine-300 text-xs">{r.checkpoints.map((c) => c.name).join(" → ")}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={r.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-2">
                          <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setRouteModal(r)}>{t("common.edit")}</button>
                          <button className={buttonDanger} onClick={() => removeRoute(r.id)}>{t("common.delete")}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {routes.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("patrol.routes.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "assignments" && (
        <div className="space-y-3">
          {canEdit && sites.length > 0 && (
            <div className="flex justify-end gap-2">
              <button className={buttonSecondary} onClick={() => setScheduleModal(true)}>{t("patrol.schedule.generate")}</button>
              <button className={buttonPrimary} onClick={() => setAssignmentModal(true)}>{t("patrol.assignments.new")}</button>
            </div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("patrol.assignments.shiftDate")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.assignments.guard")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.assignments.route")}</th>
                  <th className="text-left px-4 py-2">{t("common.status")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.assignments.colProgress")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const loggedCount = new Set(a.logs.filter((l) => l.checkpointId).map((l) => l.checkpointId)).size;
                  return (
                    <tr key={a.id} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                      <td className="px-4 py-2 text-mine-300">{new Date(a.shiftDate).toLocaleDateString()}</td>
                      <td className="px-4 py-2 font-medium">{a.worker.name}</td>
                      <td className="px-4 py-2 text-mine-300">{a.route.name}</td>
                      <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-2 text-mine-300 text-xs">{loggedCount}/{a.route.checkpoints.length}</td>
                      <td className="px-4 py-2 text-right">
                        {canEdit && (
                          <button className={buttonDanger} onClick={() => removeAssignment(a.id)}>{t("common.delete")}</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {assignments.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("patrol.assignments.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "guards" && (
        <div className="space-y-3">
          <p className="text-xs text-mine-400">{t("patrol.guards.hint")}</p>
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("patrol.guards.colGuard")}</th>
                  <th className="text-left px-4 py-2">{t("common.site")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.duty.onDuty")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.guards.colLink")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {guardSummaries.map((g) => (
                  <tr key={g.id} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                    <td className="px-4 py-2 font-medium">{g.name}</td>
                    <td className="px-4 py-2 text-mine-300">{g.site?.name}</td>
                    <td className="px-4 py-2">
                      {g.onDutySince ? (
                        <span className="text-success-500 text-xs">{t("patrol.duty.onDuty")} · {new Date(g.onDutySince).toLocaleString()}</span>
                      ) : (
                        <span className="text-mine-400 text-xs">{t("patrol.duty.offDuty")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {g.hasDutyLink ? (
                        <span className="text-success-500">{t("patrol.guards.linkActive")}</span>
                      ) : (
                        <span className="text-mine-400">{t("patrol.guards.noLink")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-2">
                          <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => generateGuardLink(g.id)}>
                            {copiedGuardId === g.id ? t("patrol.linkCopied") : g.hasDutyLink ? t("patrol.guards.regenerateLink") : t("patrol.guards.generateLink")}
                          </button>
                          {g.hasDutyLink && (
                            <button className={buttonDanger} onClick={() => revokeGuardLink(g.id)}>{t("patrol.guards.revoke")}</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {guardSummaries.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("patrol.guards.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "performance" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-mine-400">{t("patrol.performance.hint")}</p>
            <div className="flex gap-1.5">
              {PERFORMANCE_WINDOWS.map((d) => (
                <button
                  key={d}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    performanceDays === d ? "bg-hazard-500 text-white border-hazard-500" : "border-mine-700 text-mine-300 hover:bg-mine-800"
                  }`}
                  onClick={() => setPerformanceDays(d)}
                >
                  {t("patrol.performance.windowDays", { count: d })}
                </button>
              ))}
            </div>
          </div>

          {performanceLoading ? (
            <div className="text-mine-300 text-sm">{t("common.loading")}</div>
          ) : (
            <>
              {performance.length > 0 && (
                <SummaryCards
                  cards={[
                    {
                      label: t("patrol.performance.summaryAvgCompletion"),
                      value: `${avgOf(performance.map((p) => p.completionRate))}%`,
                    },
                    {
                      label: t("patrol.performance.summaryAvgCompliance"),
                      value: `${avgOf(performance.map((p) => p.checkpointComplianceRate))}%`,
                    },
                    {
                      label: t("patrol.performance.summaryMissedShifts"),
                      value: performance.reduce((sum, p) => sum + p.missedAssignments, 0),
                      tone: performance.some((p) => p.missedAssignments > 0) ? "danger" : "default",
                    },
                    {
                      label: t("patrol.performance.summaryObservations"),
                      value: performance.reduce((sum, p) => sum + p.observationsLogged, 0),
                    },
                  ]}
                />
              )}
              <DataTable
                columns={performanceColumns}
                rows={performance}
                rowKey={(p) => p.workerId}
                emptyMessage={t("patrol.performance.noneYet")}
                searchValue={(p) => `${p.name} ${p.site?.name ?? ""}`}
                exportFilename="guard-performance"
                exportColumns={[
                  { header: t("patrol.guards.colGuard"), value: (p) => p.name },
                  { header: t("common.site"), value: (p) => p.site?.name ?? "" },
                  { header: t("patrol.performance.completionRate"), value: (p) => p.completionRate ?? "" },
                  { header: t("patrol.performance.checkpointCompliance"), value: (p) => p.checkpointComplianceRate ?? "" },
                  { header: t("patrol.performance.avgDuration"), value: (p) => p.avgPatrolDurationMinutes ?? "" },
                  { header: t("patrol.performance.observations"), value: (p) => p.observationsLogged },
                  { header: t("patrol.performance.dutyHours"), value: (p) => p.dutyHours },
                ]}
              />
            </>
          )}
        </div>
      )}

      {subTab === "dutyLog" && (
        <div className="space-y-3">
          <p className="text-xs text-mine-400">{t("patrol.dutyLog.hint")}</p>
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("patrol.guards.colGuard")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.dutyLog.colDate")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.dutyLog.colOnDuty")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.dutyLog.colOffDuty")}</th>
                </tr>
              </thead>
              <tbody>
                {dutyLog.map((entry) => (
                  <tr key={entry.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                    <td className="px-4 py-2 font-medium">
                      {entry.worker.name}
                      <div className="text-[10px] text-mine-400">{entry.worker.site?.name}</div>
                    </td>
                    <td className="px-4 py-2 text-mine-300">{new Date(entry.checkInAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-mine-300">{new Date(entry.checkInAt).toLocaleTimeString()}</td>
                    <td className="px-4 py-2 text-mine-300">{entry.checkOutAt ? new Date(entry.checkOutAt).toLocaleTimeString() : "—"}</td>
                  </tr>
                ))}
                {dutyLog.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-mine-400">{t("patrol.dutyLog.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "observations" && (
        <div className="space-y-3">
          <p className="text-xs text-mine-400">{t("patrol.observations.hint")}</p>
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("patrol.dutyLog.colDate")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.guards.colGuard")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.duty.observationCategory")}</th>
                  <th className="text-left px-4 py-2">{t("common.notes")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.observations.colPhoto")}</th>
                  <th className="text-left px-4 py-2">{t("patrol.observations.colLocation")}</th>
                </tr>
              </thead>
              <tbody>
                {observations.map((o) => (
                  <tr key={o.id} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                    <td className="px-4 py-2 text-mine-300 whitespace-nowrap">{new Date(o.loggedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 font-medium">{o.worker?.name}<div className="text-[10px] text-mine-400">{o.site?.name}</div></td>
                    <td className="px-4 py-2">{o.category && <StatusBadge status={o.category} />}</td>
                    <td className="px-4 py-2 text-mine-300">{o.notes ?? "—"}</td>
                    <td className="px-4 py-2">
                      {o.photoMimeType ? (
                        <a className="text-xs text-mine-300 hover:text-mine-50 underline" href={`${API_URL}/api/patrol/public/log-entries/${o.id}/photo`} target="_blank" rel="noreferrer">
                          {t("patrol.observations.viewPhoto")}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {o.latitude != null && o.longitude != null ? (
                        <a className="text-xs text-mine-300 hover:text-mine-50 underline" href={`https://www.openstreetmap.org/?mlat=${o.latitude}&mlon=${o.longitude}#map=18/${o.latitude}/${o.longitude}`} target="_blank" rel="noreferrer">
                          {t("patrol.observations.viewLocation")}
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {observations.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("patrol.observations.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {routeModal && (
        <Modal title={routeModal === "create" ? t("patrol.routes.newTitle") : t("patrol.routes.editTitle")} onClose={() => setRouteModal(null)} size="lg">
          <RouteForm
            sites={sites}
            initial={routeModal === "create" ? undefined : routeModal}
            onSubmit={(data) => (routeModal === "create" ? createRoute(data) : updateRoute(routeModal.id, data))}
            onCancel={() => setRouteModal(null)}
          />
        </Modal>
      )}

      {assignmentModal && (
        <Modal title={t("patrol.assignments.newTitle")} onClose={() => setAssignmentModal(false)}>
          <AssignmentForm sites={sites} routes={routes} guards={guards} onSubmit={createAssignment} onCancel={() => setAssignmentModal(false)} />
        </Modal>
      )}

      {scheduleModal && (
        <Modal title={t("patrol.schedule.title")} onClose={() => setScheduleModal(false)}>
          <ScheduleGenerateForm
            sites={sites}
            routes={routes}
            guards={guards}
            onSubmit={generateSchedule}
            onCancel={() => setScheduleModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}
