import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { BeaconCondition, BeaconType, BoundaryBeacon, Site, SurveyPlan } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import DueDate, { isOverdue } from "./DueDate";
import StatTile from "../plant/StatTile";

const beaconTypes: BeaconType[] = ["PRIMARY_SG_BEACON", "SECONDARY_MINE_BEACON", "UNDERGROUND_STATION", "OTHER"];
const beaconConditions: BeaconCondition[] = ["INTACT", "DAMAGED", "MISSING", "REPLACED"];

function SurveyPlanForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: SurveyPlan;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [planReferenceNumber, setPlanReferenceNumber] = useState(initial?.planReferenceNumber ?? "");
  const [surveyDate, setSurveyDate] = useState(initial?.surveyDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [surveyorName, setSurveyorName] = useState(initial?.surveyorName ?? "");
  const [surveyorRegistrationNumber, setSurveyorRegistrationNumber] = useState(initial?.surveyorRegistrationNumber ?? "");
  const [workingsExtentDescription, setWorkingsExtentDescription] = useState(initial?.workingsExtentDescription ?? "");
  const [submittedToRegulator, setSubmittedToRegulator] = useState(initial?.submittedToRegulator ?? false);
  const [submittedDate, setSubmittedDate] = useState(initial?.submittedDate?.slice(0, 10) ?? "");
  const [nextSurveyDue, setNextSurveyDue] = useState(initial?.nextSurveyDue?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        planReferenceNumber: planReferenceNumber || undefined,
        surveyDate,
        surveyorName,
        surveyorRegistrationNumber: surveyorRegistrationNumber || undefined,
        workingsExtentDescription: workingsExtentDescription || undefined,
        submittedToRegulator,
        submittedDate: submittedDate || null,
        nextSurveyDue: nextSurveyDue || null,
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
          <label className={labelClass}>{t("resourceGovernance.survey.planReferenceNumber")}</label>
          <input className={inputClass} value={planReferenceNumber} onChange={(e) => setPlanReferenceNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.survey.surveyDate")}</label>
          <DateField value={surveyDate} onChange={setSurveyDate} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.survey.nextSurveyDue")}</label>
          <DateField value={nextSurveyDue} onChange={setNextSurveyDue} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.survey.surveyorName")}</label>
          <input className={inputClass} value={surveyorName} onChange={(e) => setSurveyorName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.survey.surveyorRegistrationNumber")}</label>
          <input className={inputClass} value={surveyorRegistrationNumber} onChange={(e) => setSurveyorRegistrationNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("resourceGovernance.survey.workingsExtentDescription")}</label>
        <textarea className={inputClass} rows={2} value={workingsExtentDescription} onChange={(e) => setWorkingsExtentDescription(e.target.value)} />
      </div>
      <div className="space-y-3 bg-mine-900/40 border border-mine-800 rounded-xl p-4">
        <label className="flex items-center gap-2 text-sm text-mine-200">
          <input type="checkbox" checked={submittedToRegulator} onChange={(e) => setSubmittedToRegulator(e.target.checked)} />
          {t("resourceGovernance.survey.submittedToRegulator")}
        </label>
        {submittedToRegulator && (
          <div>
            <label className={labelClass}>{t("resourceGovernance.survey.submittedDate")}</label>
            <DateField value={submittedDate} onChange={setSubmittedDate} />
          </div>
        )}
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

function BeaconForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: BoundaryBeacon;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [beaconType, setBeaconType] = useState<BeaconType>(initial?.beaconType ?? "SECONDARY_MINE_BEACON");
  const [latitude, setLatitude] = useState(initial?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initial?.longitude?.toString() ?? "");
  const [lastVerifiedDate, setLastVerifiedDate] = useState(initial?.lastVerifiedDate?.slice(0, 10) ?? "");
  const [nextVerificationDue, setNextVerificationDue] = useState(initial?.nextVerificationDue?.slice(0, 10) ?? "");
  const [condition, setCondition] = useState<BeaconCondition>(initial?.condition ?? "INTACT");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        identifier,
        beaconType,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        lastVerifiedDate: lastVerifiedDate || null,
        nextVerificationDue: nextVerificationDue || null,
        condition,
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
          <label className={labelClass}>{t("resourceGovernance.survey.beaconIdentifier")}</label>
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.survey.beaconType")}</label>
          <select className={selectClass} value={beaconType} onChange={(e) => setBeaconType(e.target.value as BeaconType)}>
            {beaconTypes.map((v) => <option key={v} value={v}>{t(`resourceGovernance.survey.beaconTypes.${v}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.site")}</label>
        <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.latitude")}</label>
          <input className={inputClass} type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.longitude")}</label>
          <input className={inputClass} type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resourceGovernance.survey.lastVerifiedDate")}</label>
          <DateField value={lastVerifiedDate} onChange={setLastVerifiedDate} />
        </div>
        <div>
          <label className={labelClass}>{t("resourceGovernance.survey.nextVerificationDue")}</label>
          <DateField value={nextVerificationDue} onChange={setNextVerificationDue} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("resourceGovernance.survey.condition")}</label>
        <select className={selectClass} value={condition} onChange={(e) => setCondition(e.target.value as BeaconCondition)}>
          {beaconConditions.map((c) => <option key={c} value={c}>{t(`resourceGovernance.survey.beaconConditions.${c}`)}</option>)}
        </select>
      </div>
      {(condition === "DAMAGED" || condition === "MISSING") && (
        <p className="text-xs text-danger-500">{t("resourceGovernance.survey.beaconIssueWarning")}</p>
      )}
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

export default function MineSurveyTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [plans, setPlans] = useState<SurveyPlan[]>([]);
  const [beacons, setBeacons] = useState<BoundaryBeacon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [planModal, setPlanModal] = useState<null | "create" | SurveyPlan>(null);
  const [beaconModal, setBeaconModal] = useState<null | "create" | BoundaryBeacon>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [p, b] = await Promise.all([
        api.get<SurveyPlan[]>("/mine-survey/plans"),
        api.get<BoundaryBeacon[]>("/mine-survey/beacons"),
      ]);
      setPlans(p.data);
      setBeacons(b.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    // Latest plan per site — an older plan for a site that has since been
    // resurveyed shouldn't count as the current state of that site.
    const latestBySite = new Map<string, SurveyPlan>();
    for (const p of plans) {
      const held = latestBySite.get(p.siteId);
      if (!held || p.surveyDate > held.surveyDate) latestBySite.set(p.siteId, p);
    }
    const sitesOverdue = [...latestBySite.values()].filter((p) => isOverdue(p.nextSurveyDue) || !p.nextSurveyDue).length;
    const sitesNeverSurveyed = sites.length - latestBySite.size;
    const beaconsWithIssue = beacons.filter((b) => b.condition === "DAMAGED" || b.condition === "MISSING").length;
    const beaconsVerificationOverdue = beacons.filter((b) => isOverdue(b.nextVerificationDue) || !b.nextVerificationDue).length;
    return { sitesOverdue: sitesOverdue + sitesNeverSurveyed, beaconsWithIssue, beaconsVerificationOverdue, beaconsTotal: beacons.length };
  }, [plans, beacons, sites]);

  async function createPlan(data: any) {
    await api.post("/mine-survey/plans", data);
    setPlanModal(null);
    await load();
  }
  async function updatePlan(id: string, data: any) {
    await api.put(`/mine-survey/plans/${id}`, data);
    setPlanModal(null);
    await load();
  }
  async function removePlan(id: string) {
    if (!confirm(t("resourceGovernance.survey.confirmDeletePlan"))) return;
    await api.delete(`/mine-survey/plans/${id}`);
    await load();
  }
  async function createBeacon(data: any) {
    await api.post("/mine-survey/beacons", data);
    setBeaconModal(null);
    await load();
  }
  async function updateBeacon(id: string, data: any) {
    await api.put(`/mine-survey/beacons/${id}`, data);
    setBeaconModal(null);
    await load();
  }
  async function removeBeacon(id: string) {
    if (!confirm(t("resourceGovernance.survey.confirmDeleteBeacon"))) return;
    await api.delete(`/mine-survey/beacons/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const planColumns: DataTableColumn<SurveyPlan>[] = [
    { key: "site", header: t("common.site"), render: (p) => p.site?.name ?? "—", sortValue: (p) => p.site?.name ?? "" },
    { key: "planReferenceNumber", header: t("resourceGovernance.survey.planReferenceNumber"), render: (p) => p.planReferenceNumber || "—", sortValue: (p) => p.planReferenceNumber ?? "" },
    { key: "surveyDate", header: t("resourceGovernance.survey.surveyDate"), render: (p) => new Date(p.surveyDate).toLocaleDateString(), sortValue: (p) => p.surveyDate },
    { key: "surveyorName", header: t("resourceGovernance.survey.surveyorName"), render: (p) => p.surveyorName, sortValue: (p) => p.surveyorName },
    { key: "nextSurveyDue", header: t("resourceGovernance.survey.nextSurveyDue"), render: (p) => <DueDate value={p.nextSurveyDue} />, sortValue: (p) => p.nextSurveyDue ?? "9999" },
    {
      key: "submittedToRegulator",
      header: t("resourceGovernance.survey.submittedShort"),
      render: (p) => (p.submittedToRegulator ? <span className="text-success-500">{t("common.yes")}</span> : <span className="text-hazard-500">{t("common.no")}</span>),
      sortValue: (p) => (p.submittedToRegulator ? 1 : 0),
    },
  ];

  const beaconColumns: DataTableColumn<BoundaryBeacon>[] = [
    { key: "identifier", header: t("resourceGovernance.survey.beaconIdentifier"), render: (b) => b.identifier, sortValue: (b) => b.identifier },
    { key: "beaconType", header: t("resourceGovernance.survey.beaconType"), render: (b) => t(`resourceGovernance.survey.beaconTypes.${b.beaconType}`), sortValue: (b) => b.beaconType },
    { key: "site", header: t("common.site"), render: (b) => b.site?.name ?? "—", sortValue: (b) => b.site?.name ?? "" },
    { key: "nextVerificationDue", header: t("resourceGovernance.survey.nextVerificationDue"), render: (b) => <DueDate value={b.nextVerificationDue} />, sortValue: (b) => b.nextVerificationDue ?? "9999" },
    { key: "condition", header: t("resourceGovernance.survey.condition"), render: (b) => <StatusBadge status={b.condition} />, sortValue: (b) => b.condition },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("resourceGovernance.survey.statSitesOverdue")}
          value={stats.sitesOverdue}
          target={t("resourceGovernance.targetZero")}
          tone={stats.sitesOverdue === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("resourceGovernance.survey.statBeaconIssues")}
          value={stats.beaconsWithIssue}
          target={t("resourceGovernance.targetZero")}
          tone={stats.beaconsWithIssue === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("resourceGovernance.survey.statVerificationOverdue")}
          value={stats.beaconsVerificationOverdue}
          target={t("resourceGovernance.survey.statVerificationOverdueTarget", { count: stats.beaconsTotal })}
          tone={stats.beaconsVerificationOverdue === 0 ? "good" : "warn"}
        />
        <StatTile label={t("resourceGovernance.survey.statBeaconsTracked")} value={stats.beaconsTotal} target={t("resourceGovernance.survey.statBeaconsTrackedTarget")} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("resourceGovernance.survey.plansTitle")}</h2>
            <p className="text-xs text-mine-400">{t("resourceGovernance.survey.plansHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setPlanModal("create")} disabled={sites.length === 0}>{t("resourceGovernance.survey.newPlan")}</button>}
        </div>
        <DataTable
          columns={planColumns}
          rows={plans}
          rowKey={(p) => p.id}
          emptyMessage={t("resourceGovernance.survey.noPlansYet")}
          searchValue={(p) => `${p.surveyorName} ${p.planReferenceNumber ?? ""}`}
          exportFilename="survey-plans"
          exportColumns={[
            { header: t("common.site"), value: (p) => p.site?.name ?? "" },
            { header: t("resourceGovernance.survey.surveyDate"), value: (p) => p.surveyDate.slice(0, 10) },
            { header: t("resourceGovernance.survey.surveyorName"), value: (p) => p.surveyorName },
            { header: t("resourceGovernance.survey.nextSurveyDue"), value: (p) => p.nextSurveyDue?.slice(0, 10) ?? "" },
          ]}
          actions={(p) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setPlanModal(p)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removePlan(p.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("resourceGovernance.survey.beaconsTitle")}</h2>
            <p className="text-xs text-mine-400">{t("resourceGovernance.survey.beaconsHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setBeaconModal("create")} disabled={sites.length === 0}>{t("resourceGovernance.survey.newBeacon")}</button>}
        </div>
        <DataTable
          columns={beaconColumns}
          rows={beacons}
          rowKey={(b) => b.id}
          emptyMessage={t("resourceGovernance.survey.noBeaconsYet")}
          searchValue={(b) => b.identifier}
          exportFilename="boundary-beacons"
          exportColumns={[
            { header: t("resourceGovernance.survey.beaconIdentifier"), value: (b) => b.identifier },
            { header: t("common.site"), value: (b) => b.site?.name ?? "" },
            { header: t("resourceGovernance.survey.condition"), value: (b) => b.condition },
          ]}
          actions={(b) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setBeaconModal(b)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removeBeacon(b.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {planModal && (
        <Modal title={planModal === "create" ? t("resourceGovernance.survey.newPlanTitle") : t("resourceGovernance.survey.editPlanTitle")} onClose={() => setPlanModal(null)}>
          <SurveyPlanForm
            sites={sites}
            initial={planModal === "create" ? undefined : planModal}
            onSubmit={(data) => (planModal === "create" ? createPlan(data) : updatePlan(planModal.id, data))}
            onCancel={() => setPlanModal(null)}
          />
        </Modal>
      )}

      {beaconModal && (
        <Modal title={beaconModal === "create" ? t("resourceGovernance.survey.newBeaconTitle") : t("resourceGovernance.survey.editBeaconTitle")} onClose={() => setBeaconModal(null)}>
          <BeaconForm
            sites={sites}
            initial={beaconModal === "create" ? undefined : beaconModal}
            onSubmit={(data) => (beaconModal === "create" ? createBeacon(data) : updateBeacon(beaconModal.id, data))}
            onCancel={() => setBeaconModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
