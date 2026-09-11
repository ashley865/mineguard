import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  EscapeReadinessSummary,
  EscapeRoute,
  EscapeRouteCondition,
  SelfRescuerStatus,
  SelfRescuerType,
  SelfRescuerUnit,
  Site,
} from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import DueDate from "./DueDate";
import StatTile from "../plant/StatTile";

const rescuerTypes: SelfRescuerType[] = ["FILTER_SELF_RESCUER", "SELF_CONTAINED_SELF_RESCUER", "CACHE_UNIT", "OTHER"];
const rescuerStatuses: SelfRescuerStatus[] = ["IN_STORE", "ISSUED", "DEPLOYED", "WITHDRAWN"];
const routeConditions: EscapeRouteCondition[] = ["CLEAR", "OBSTRUCTED", "IMPASSABLE", "UNDER_REPAIR"];

function RescuerForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: SelfRescuerUnit;
  onSubmit: (d: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? "");
  const [rescuerType, setRescuerType] = useState<SelfRescuerType>(initial?.rescuerType ?? "SELF_CONTAINED_SELF_RESCUER");
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate?.slice(0, 10) ?? "");
  const [issuedToName, setIssuedToName] = useState(initial?.issuedToName ?? "");
  const [issuedDate, setIssuedDate] = useState(initial?.issuedDate?.slice(0, 10) ?? "");
  const [storageLocation, setStorageLocation] = useState(initial?.storageLocation ?? "");
  const [nextInspectionDue, setNextInspectionDue] = useState(initial?.nextInspectionDue?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<SelfRescuerStatus>(
    initial && initial.status !== "EXPIRED" ? initial.status : "IN_STORE"
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const alreadyExpired = expiryDate !== "" && new Date(expiryDate) < new Date();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        serialNumber,
        rescuerType,
        manufacturer: manufacturer || undefined,
        expiryDate: expiryDate || null,
        issuedDate: issuedDate || null,
        issuedToName: issuedToName || undefined,
        storageLocation: storageLocation || undefined,
        nextInspectionDue: nextInspectionDue || null,
        status,
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
          <label className={labelClass}>{t("ventilationRegisters.escape.serialNumber")}</label>
          <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.rescuerType")}</label>
          <select className={selectClass} value={rescuerType} onChange={(e) => setRescuerType(e.target.value as SelfRescuerType)}>
            {rescuerTypes.map((v) => <option key={v} value={v}>{t(`ventilationRegisters.escape.rescuerTypes.${v}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.expiryDate")}</label>
          <DateField value={expiryDate} onChange={setExpiryDate} />
        </div>
      </div>
      {alreadyExpired && <p className="text-xs text-danger-500">{t("ventilationRegisters.escape.expiredWarning")}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.issuedTo")}</label>
          <input className={inputClass} value={issuedToName} onChange={(e) => setIssuedToName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.issuedDate")}</label>
          <DateField value={issuedDate} onChange={setIssuedDate} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.storageLocation")}</label>
          <input className={inputClass} value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.nextInspectionDue")}</label>
          <DateField value={nextInspectionDue} onChange={setNextInspectionDue} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as SelfRescuerStatus)}>
            {rescuerStatuses.map((s) => <option key={s} value={s}>{t(`ventilationRegisters.escape.rescuerStatuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("ventilationRegisters.manufacturer")}</label>
        <input className={inputClass} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
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

function RouteForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: EscapeRoute;
  onSubmit: (d: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [fromLocation, setFromLocation] = useState(initial?.fromLocation ?? "");
  const [toLocation, setToLocation] = useState(initial?.toLocation ?? "");
  const [routeLengthM, setRouteLengthM] = useState(initial?.routeLengthM?.toString() ?? "");
  const [isSecondOutlet, setIsSecondOutlet] = useState(initial?.isSecondOutlet ?? false);
  const [lastWalkedDate, setLastWalkedDate] = useState(initial?.lastWalkedDate?.slice(0, 10) ?? "");
  const [nextInspectionDue, setNextInspectionDue] = useState(initial?.nextInspectionDue?.slice(0, 10) ?? "");
  const [condition, setCondition] = useState<EscapeRouteCondition>(initial?.condition ?? "CLEAR");
  const [findings, setFindings] = useState(initial?.findings ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        identifier,
        fromLocation,
        toLocation,
        routeLengthM: routeLengthM ? Number(routeLengthM) : null,
        isSecondOutlet,
        lastWalkedDate: lastWalkedDate || null,
        nextInspectionDue: nextInspectionDue || null,
        condition,
        findings: findings || undefined,
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
          <label className={labelClass}>{t("ventilationRegisters.escape.routeIdentifier")}</label>
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.fromLocation")}</label>
          <input className={inputClass} value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.toLocation")}</label>
          <input className={inputClass} value={toLocation} onChange={(e) => setToLocation(e.target.value)} required />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-mine-200">
        <input type="checkbox" className="mt-1" checked={isSecondOutlet} onChange={(e) => setIsSecondOutlet(e.target.checked)} />
        <span>
          {t("ventilationRegisters.escape.isSecondOutlet")}
          <span className="block text-[11px] text-mine-400">{t("ventilationRegisters.escape.secondOutletHint")}</span>
        </span>
      </label>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.routeLength")}</label>
          <input className={inputClass} type="number" min={0} step="1" value={routeLengthM} onChange={(e) => setRouteLengthM(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.lastWalked")}</label>
          <DateField value={lastWalkedDate} onChange={setLastWalkedDate} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.escape.nextInspectionDue")}</label>
          <DateField value={nextInspectionDue} onChange={setNextInspectionDue} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("ventilationRegisters.escape.condition")}</label>
        <select className={selectClass} value={condition} onChange={(e) => setCondition(e.target.value as EscapeRouteCondition)}>
          {routeConditions.map((c) => <option key={c} value={c}>{t(`ventilationRegisters.escape.routeConditions.${c}`)}</option>)}
        </select>
      </div>
      {(condition === "OBSTRUCTED" || condition === "IMPASSABLE") && (
        <p className="text-xs text-danger-500">{t("ventilationRegisters.escape.blockedWarning")}</p>
      )}
      <div>
        <label className={labelClass}>{t("ventilationRegisters.findings")}</label>
        <textarea className={inputClass} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
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

export default function EscapeReadinessTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [rescuers, setRescuers] = useState<SelfRescuerUnit[]>([]);
  const [routes, setRoutes] = useState<EscapeRoute[]>([]);
  const [summary, setSummary] = useState<EscapeReadinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rescuerModal, setRescuerModal] = useState<null | "create" | SelfRescuerUnit>(null);
  const [routeModal, setRouteModal] = useState<null | "create" | EscapeRoute>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [r, rt, s] = await Promise.all([
        api.get<SelfRescuerUnit[]>("/escape-readiness/self-rescuers"),
        api.get<EscapeRoute[]>("/escape-readiness/routes"),
        api.get<EscapeReadinessSummary>("/escape-readiness/summary"),
      ]);
      setRescuers(r.data);
      setRoutes(rt.data);
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

  async function createRescuer(d: any) { await api.post("/escape-readiness/self-rescuers", d); setRescuerModal(null); await load(); }
  async function updateRescuer(id: string, d: any) { await api.put(`/escape-readiness/self-rescuers/${id}`, d); setRescuerModal(null); await load(); }
  async function removeRescuer(id: string) {
    if (!confirm(t("ventilationRegisters.escape.confirmDeleteRescuer"))) return;
    await api.delete(`/escape-readiness/self-rescuers/${id}`);
    await load();
  }
  async function createRoute(d: any) { await api.post("/escape-readiness/routes", d); setRouteModal(null); await load(); }
  async function updateRoute(id: string, d: any) { await api.put(`/escape-readiness/routes/${id}`, d); setRouteModal(null); await load(); }
  async function removeRoute(id: string) {
    if (!confirm(t("ventilationRegisters.escape.confirmDeleteRoute"))) return;
    await api.delete(`/escape-readiness/routes/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError || !summary) return <LoadError onRetry={load} />;

  const rescuerColumns: DataTableColumn<SelfRescuerUnit>[] = [
    { key: "serialNumber", header: t("ventilationRegisters.escape.serialNumber"), render: (r) => r.serialNumber, sortValue: (r) => r.serialNumber },
    { key: "rescuerType", header: t("common.type"), render: (r) => t(`ventilationRegisters.escape.rescuerTypes.${r.rescuerType}`), sortValue: (r) => r.rescuerType },
    { key: "site", header: t("common.site"), render: (r) => r.site?.name ?? "—", sortValue: (r) => r.site?.name ?? "" },
    { key: "issuedToName", header: t("ventilationRegisters.escape.issuedTo"), render: (r) => r.issuedToName || r.storageLocation || "—", sortValue: (r) => r.issuedToName ?? "" },
    { key: "expiryDate", header: t("ventilationRegisters.escape.expiryDate"), render: (r) => <DueDate value={r.expiryDate} withinDays={90} />, sortValue: (r) => r.expiryDate ?? "9999" },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} />, sortValue: (r) => r.status },
  ];

  const routeColumns: DataTableColumn<EscapeRoute>[] = [
    {
      key: "identifier",
      header: t("ventilationRegisters.escape.routeIdentifier"),
      render: (r) => (
        <span>
          {r.identifier}
          {r.isSecondOutlet && <span className="ml-2 text-[10px] font-semibold text-hazard-500">{t("ventilationRegisters.escape.secondOutletShort")}</span>}
        </span>
      ),
      sortValue: (r) => r.identifier,
    },
    { key: "route", header: t("ventilationRegisters.escape.routeShort"), render: (r) => `${r.fromLocation} → ${r.toLocation}`, sortValue: (r) => r.fromLocation },
    { key: "site", header: t("common.site"), render: (r) => r.site?.name ?? "—", sortValue: (r) => r.site?.name ?? "" },
    { key: "nextInspectionDue", header: t("ventilationRegisters.escape.nextInspectionDue"), render: (r) => <DueDate value={r.nextInspectionDue} />, sortValue: (r) => r.nextInspectionDue ?? "9999" },
    { key: "condition", header: t("ventilationRegisters.escape.condition"), render: (r) => <StatusBadge status={r.condition} />, sortValue: (r) => r.condition },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("ventilationRegisters.escape.statReadinessGaps")}
          value={summary.readinessGaps}
          target={t("ventilationRegisters.escape.statReadinessGapsTarget")}
          tone={summary.readinessGaps === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("ventilationRegisters.escape.statExpired")}
          value={summary.selfRescuers.expired}
          target={t("ventilationRegisters.escape.statExpiredTarget", { count: summary.selfRescuers.expiringWithin90Days })}
          tone={summary.selfRescuers.expired === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("ventilationRegisters.escape.statRoutesBlocked")}
          value={summary.escapeRoutes.blocked}
          target={t("ventilationRegisters.escape.statRoutesBlockedTarget", { count: summary.escapeRoutes.secondOutlets })}
          tone={summary.escapeRoutes.blocked === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("ventilationRegisters.escape.statShelterCapacity")}
          value={summary.refugeBays.operationalShelterCapacity}
          target={t("ventilationRegisters.escape.statShelterCapacityTarget", { count: summary.refugeBays.notOperational })}
          tone={summary.refugeBays.notOperational === 0 ? "good" : "warn"}
        />
      </div>

      <div className="bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6">
        <h2 className="text-sm font-semibold text-mine-200">{t("ventilationRegisters.escape.chainTitle")}</h2>
        <p className="text-xs text-mine-400 mb-3">{t("ventilationRegisters.escape.chainHint")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-mine-800 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-mine-300 uppercase tracking-wider mb-2">{t("ventilationRegisters.escape.linkRescuers")}</h3>
            <div className="flex items-center justify-between text-xs py-1"><span className="text-mine-300">{t("ventilationRegisters.escape.inService")}</span><span className="font-semibold tabular-nums">{summary.selfRescuers.inService}</span></div>
            <div className="flex items-center justify-between text-xs py-1"><span className="text-mine-300">{t("ventilationRegisters.escape.expired")}</span><span className={`font-semibold tabular-nums ${summary.selfRescuers.expired > 0 ? "text-danger-500" : "text-success-500"}`}>{summary.selfRescuers.expired}</span></div>
            <div className="flex items-center justify-between text-xs py-1"><span className="text-mine-300">{t("ventilationRegisters.escape.inspectionOverdue")}</span><span className={`font-semibold tabular-nums ${summary.selfRescuers.inspectionOverdue > 0 ? "text-hazard-500" : "text-success-500"}`}>{summary.selfRescuers.inspectionOverdue}</span></div>
          </div>
          <div className="border border-mine-800 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-mine-300 uppercase tracking-wider mb-2">{t("ventilationRegisters.escape.linkRoutes")}</h3>
            <div className="flex items-center justify-between text-xs py-1"><span className="text-mine-300">{t("ventilationRegisters.escape.totalRoutes")}</span><span className="font-semibold tabular-nums">{summary.escapeRoutes.total}</span></div>
            <div className="flex items-center justify-between text-xs py-1"><span className="text-mine-300">{t("ventilationRegisters.escape.blocked")}</span><span className={`font-semibold tabular-nums ${summary.escapeRoutes.blocked > 0 ? "text-danger-500" : "text-success-500"}`}>{summary.escapeRoutes.blocked}</span></div>
            <div className="flex items-center justify-between text-xs py-1"><span className="text-mine-300">{t("ventilationRegisters.escape.inspectionOverdue")}</span><span className={`font-semibold tabular-nums ${summary.escapeRoutes.inspectionOverdue > 0 ? "text-hazard-500" : "text-success-500"}`}>{summary.escapeRoutes.inspectionOverdue}</span></div>
          </div>
          <div className="border border-mine-800 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-mine-300 uppercase tracking-wider mb-2">{t("ventilationRegisters.escape.linkBays")}</h3>
            <div className="flex items-center justify-between text-xs py-1"><span className="text-mine-300">{t("ventilationRegisters.escape.totalBays")}</span><span className="font-semibold tabular-nums">{summary.refugeBays.total}</span></div>
            <div className="flex items-center justify-between text-xs py-1"><span className="text-mine-300">{t("ventilationRegisters.escape.notOperational")}</span><span className={`font-semibold tabular-nums ${summary.refugeBays.notOperational > 0 ? "text-danger-500" : "text-success-500"}`}>{summary.refugeBays.notOperational}</span></div>
            <div className="flex items-center justify-between text-xs py-1"><span className="text-mine-300">{t("ventilationRegisters.escape.inspectionOverdue")}</span><span className={`font-semibold tabular-nums ${summary.refugeBays.inspectionOverdue > 0 ? "text-hazard-500" : "text-success-500"}`}>{summary.refugeBays.inspectionOverdue}</span></div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("ventilationRegisters.escape.rescuersTitle")}</h2>
            <p className="text-xs text-mine-400">{t("ventilationRegisters.escape.rescuersHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setRescuerModal("create")} disabled={sites.length === 0}>{t("ventilationRegisters.escape.newRescuer")}</button>}
        </div>
        <DataTable
          columns={rescuerColumns}
          rows={rescuers}
          rowKey={(r) => r.id}
          emptyMessage={t("ventilationRegisters.escape.noRescuersYet")}
          searchValue={(r) => `${r.serialNumber} ${r.issuedToName ?? ""} ${r.storageLocation ?? ""}`}
          exportFilename="self-rescuer-units"
          exportColumns={[
            { header: t("ventilationRegisters.escape.serialNumber"), value: (r) => r.serialNumber },
            { header: t("common.type"), value: (r) => r.rescuerType },
            { header: t("ventilationRegisters.escape.expiryDate"), value: (r) => r.expiryDate?.slice(0, 10) ?? "" },
            { header: t("common.status"), value: (r) => r.status },
          ]}
          actions={(r) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setRescuerModal(r)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removeRescuer(r.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("ventilationRegisters.escape.routesTitle")}</h2>
            <p className="text-xs text-mine-400">{t("ventilationRegisters.escape.routesHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setRouteModal("create")} disabled={sites.length === 0}>{t("ventilationRegisters.escape.newRoute")}</button>}
        </div>
        <DataTable
          columns={routeColumns}
          rows={routes}
          rowKey={(r) => r.id}
          emptyMessage={t("ventilationRegisters.escape.noRoutesYet")}
          searchValue={(r) => `${r.identifier} ${r.fromLocation} ${r.toLocation}`}
          exportFilename="escape-routes"
          exportColumns={[
            { header: t("ventilationRegisters.escape.routeIdentifier"), value: (r) => r.identifier },
            { header: t("ventilationRegisters.escape.fromLocation"), value: (r) => r.fromLocation },
            { header: t("ventilationRegisters.escape.toLocation"), value: (r) => r.toLocation },
            { header: t("ventilationRegisters.escape.condition"), value: (r) => r.condition },
          ]}
          actions={(r) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setRouteModal(r)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removeRoute(r.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {rescuerModal && (
        <Modal title={rescuerModal === "create" ? t("ventilationRegisters.escape.newRescuerTitle") : t("ventilationRegisters.escape.editRescuerTitle")} onClose={() => setRescuerModal(null)}>
          <RescuerForm
            sites={sites}
            initial={rescuerModal === "create" ? undefined : rescuerModal}
            onSubmit={(d) => (rescuerModal === "create" ? createRescuer(d) : updateRescuer(rescuerModal.id, d))}
            onCancel={() => setRescuerModal(null)}
          />
        </Modal>
      )}

      {routeModal && (
        <Modal title={routeModal === "create" ? t("ventilationRegisters.escape.newRouteTitle") : t("ventilationRegisters.escape.editRouteTitle")} onClose={() => setRouteModal(null)}>
          <RouteForm
            sites={sites}
            initial={routeModal === "create" ? undefined : routeModal}
            onSubmit={(d) => (routeModal === "create" ? createRoute(d) : updateRoute(routeModal.id, d))}
            onCancel={() => setRouteModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
