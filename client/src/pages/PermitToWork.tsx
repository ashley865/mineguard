import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useAssignedSiteIds } from "../hooks/useAssignedSiteIds";
import { Contractor, PermitToWork as PermitToWorkType, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

function PtwForm({
  sites,
  contractors,
  onSubmit,
  onCancel,
}: {
  sites: Site[];
  contractors: Contractor[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [contractorId, setContractorId] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [workArea, setWorkArea] = useState("");
  const [hazardsIdentified, setHazardsIdentified] = useState("");
  const [controlMeasures, setControlMeasures] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requestedByName, setRequestedByName] = useState("");
  const [saving, setSaving] = useState(false);

  const contractorsForSite = contractors.filter((c) => c.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        contractorId,
        workDescription,
        workArea,
        hazardsIdentified,
        controlMeasures,
        startDate,
        endDate,
        requestedByName,
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
          <select className={inputClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setContractorId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("permitToWork.contractor")}</label>
          <select className={inputClass} value={contractorId} onChange={(e) => setContractorId(e.target.value)} required>
            <option value="">{t("permitToWork.selectContractor")}</option>
            {contractorsForSite.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("permitToWork.workDescription")}</label>
        <textarea className={inputClass} rows={2} value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("permitToWork.workArea")}</label>
          <input className={inputClass} value={workArea} onChange={(e) => setWorkArea(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("permitToWork.requestedBy")}</label>
          <input className={inputClass} value={requestedByName} onChange={(e) => setRequestedByName(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("permitToWork.hazardsIdentified")}</label>
        <textarea className={inputClass} rows={2} value={hazardsIdentified} onChange={(e) => setHazardsIdentified(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("permitToWork.controlMeasures")}</label>
        <textarea className={inputClass} rows={2} value={controlMeasures} onChange={(e) => setControlMeasures(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("permitToWork.startDate")}</label>
          <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("permitToWork.endDate")}</label>
          <input className={inputClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving || !contractorId}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DecisionRow({ onApprove, onReject }: { onApprove: (note: string) => void; onReject: (note: string) => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  return (
    <div className="flex gap-2 items-center mt-2">
      <input
        className="flex-1 bg-mine-800 border border-mine-700 rounded-md px-2 py-1 text-xs"
        placeholder={t("common.reviewNotePlaceholder") ?? ""}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => onApprove(note)}>{t("common.approve")}</button>
      <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => onReject(note)}>{t("common.reject")}</button>
    </div>
  );
}

export default function PermitToWork() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { siteIds: assignedSiteIds, loading: loadingAssignment } = useAssignedSiteIds();
  const [sites, setSites] = useState<Site[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [items, setItems] = useState<PermitToWorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const availableSites = assignedSiteIds === null ? sites : sites.filter((s) => assignedSiteIds.includes(s.id));
  const canDecideSupervisor = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDecideExecutive = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";

  async function load() {
    setLoading(true);
    const [s, c, p] = await Promise.all([
      api.get<Site[]>("/sites"),
      api.get<Contractor[]>("/contractors"),
      api.get<PermitToWorkType[]>("/permits-to-work"),
    ]);
    setSites(s.data);
    setContractors(c.data);
    setItems(p.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/permits-to-work", data);
    setModal(false);
    await load();
  }

  async function supervisorDecision(id: string, decision: "APPROVED" | "REJECTED", note: string) {
    await api.post(`/permits-to-work/${id}/supervisor-decision`, { decision, note: note || undefined });
    await load();
  }

  async function executiveDecision(id: string, decision: "APPROVED" | "REJECTED", note: string) {
    await api.post(`/permits-to-work/${id}/executive-decision`, { decision, note: note || undefined });
    await load();
  }

  async function close(id: string) {
    await api.post(`/permits-to-work/${id}/close`);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("permitToWork.confirmDelete"))) return;
    await api.delete(`/permits-to-work/${id}`);
    await load();
  }

  if (loading || loadingAssignment) return <div className="text-mine-300">{t("permitToWork.loading")}</div>;

  if (availableSites.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">{t("permitToWork.title")}</h1>
        <div className={`${cardClass} p-6 text-center text-mine-300`}>{t("permitToWork.noSiteAccess")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("permitToWork.title")}</h1>
          <p className="text-mine-300 text-sm">{t("permitToWork.subtitle")}</p>
        </div>
        <button className={buttonPrimary} onClick={() => setModal(true)}>{t("permitToWork.new")}</button>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("permitToWork.noneYet")}</div>}
        {items.map((ptw) => (
          <div key={ptw.id} className={`${cardClass} p-5 space-y-2`}>
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold text-sm">{ptw.contractor?.companyName} — {ptw.workArea}</div>
                <div className="text-xs text-mine-400">{ptw.site?.name} · {new Date(ptw.startDate).toLocaleDateString()} – {new Date(ptw.endDate).toLocaleDateString()}</div>
              </div>
              <StatusBadge status={ptw.status} />
            </div>
            <p className="text-sm text-mine-300">{ptw.workDescription}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-mine-400">
              <div><span className="font-semibold text-mine-300">{t("permitToWork.hazardsIdentified")}: </span>{ptw.hazardsIdentified}</div>
              <div><span className="font-semibold text-mine-300">{t("permitToWork.controlMeasures")}: </span>{ptw.controlMeasures}</div>
            </div>

            {ptw.status === "PENDING_SUPERVISOR" && canDecideSupervisor && (
              <DecisionRow
                onApprove={(note) => supervisorDecision(ptw.id, "APPROVED", note)}
                onReject={(note) => supervisorDecision(ptw.id, "REJECTED", note)}
              />
            )}
            {ptw.status === "PENDING_EXECUTIVE" && canDecideExecutive && (
              <DecisionRow
                onApprove={(note) => executiveDecision(ptw.id, "APPROVED", note)}
                onReject={(note) => executiveDecision(ptw.id, "REJECTED", note)}
              />
            )}
            {ptw.status === "PENDING_EXECUTIVE" && !canDecideExecutive && (
              <div className="text-xs text-mine-400">{t("permitToWork.awaitingExecutive")}</div>
            )}
            {ptw.status === "APPROVED" && canDecideSupervisor && (
              <div className="flex justify-end">
                <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => close(ptw.id)}>{t("permitToWork.close")}</button>
              </div>
            )}
            {canDelete && (
              <div className="flex justify-end">
                <button className={buttonDanger} onClick={() => remove(ptw.id)}>{t("common.delete")}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={t("permitToWork.newTitle")} onClose={() => setModal(false)}>
          <PtwForm sites={availableSites} contractors={contractors} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
