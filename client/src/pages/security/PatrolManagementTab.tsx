import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { PatrolAssignment, PatrolRoute, Site, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

type SubTab = "routes" | "assignments";

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
            {guardsForSite.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.employeeId})</option>)}
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

export default function PatrolManagementTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [subTab, setSubTab] = useState<SubTab>("routes");
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [assignments, setAssignments] = useState<PatrolAssignment[]>([]);
  const [guards, setGuards] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeModal, setRouteModal] = useState<null | "create" | PatrolRoute>(null);
  const [assignmentModal, setAssignmentModal] = useState(false);
  const [copiedSiteId, setCopiedSiteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [r, a, g] = await Promise.all([
      api.get<PatrolRoute[]>("/patrol/routes"),
      api.get<PatrolAssignment[]>("/patrol/assignments"),
      api.get<Worker[]>("/workers", { params: { category: "SECURITY" } }),
    ]);
    setRoutes(r.data);
    setAssignments(a.data);
    setGuards(g.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
            <div className="flex justify-end">
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
    </div>
  );
}
