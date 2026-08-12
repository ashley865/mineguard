import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { IodClaim, IodClaimStatus, Incident, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const claimStatuses: IodClaimStatus[] = ["REPORTED", "SUBMITTED", "UNDER_ASSESSMENT", "ACCEPTED", "REJECTED", "CLOSED"];

function ClaimForm({ workers, incidents, initial, onSubmit, onCancel }: {
  workers: Worker[];
  incidents: Incident[];
  initial?: IodClaim;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [incidentId, setIncidentId] = useState(initial?.incidentId ?? "");
  const [claimNumber, setClaimNumber] = useState(initial?.claimNumber ?? "");
  const [dateOfInjury, setDateOfInjury] = useState(initial?.dateOfInjury?.slice(0, 10) ?? "");
  const [natureOfInjury, setNatureOfInjury] = useState(initial?.natureOfInjury ?? "");
  const [wclForm2Filed, setWclForm2Filed] = useState(initial?.wclForm2Filed ?? false);
  const [status, setStatus] = useState<IodClaimStatus>(initial?.status ?? "REPORTED");
  const [compensationAmount, setCompensationAmount] = useState(initial?.compensationAmount?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId,
        incidentId: incidentId || null,
        claimNumber: claimNumber || undefined,
        dateOfInjury,
        natureOfInjury,
        wclForm2Filed,
        wclForm2FiledAt: wclForm2Filed ? new Date().toISOString() : null,
        status,
        compensationAmount: compensationAmount ? Number(compensationAmount) : null,
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
          <label className={labelClass}>{t("iodClaims.worker")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("iodClaims.relatedIncident")}</label>
          <select className={selectClass} value={incidentId} onChange={(e) => setIncidentId(e.target.value)}>
            <option value="">{t("iodClaims.noRelatedIncident")}</option>
            {incidents.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("iodClaims.dateOfInjury")}</label>
          <DateField value={dateOfInjury} onChange={setDateOfInjury} required />
        </div>
        <div>
          <label className={labelClass}>{t("iodClaims.claimNumber")}</label>
          <input className={inputClass} value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("iodClaims.natureOfInjury")}</label>
        <textarea className={inputClass} rows={2} value={natureOfInjury} onChange={(e) => setNatureOfInjury(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as IodClaimStatus)}>
            {claimStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("iodClaims.compensationAmount")}</label>
          <input className={inputClass} type="number" step="any" value={compensationAmount} onChange={(e) => setCompensationAmount(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={wclForm2Filed} onChange={(e) => setWclForm2Filed(e.target.checked)} />
        {t("iodClaims.wclForm2Filed")}
      </label>
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

export default function IodClaimsTab({ workers }: { workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [claims, setClaims] = useState<IodClaim[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | IodClaim>(null);

  async function load() {
    setLoading(true);
    const [c, i] = await Promise.all([
      api.get<IodClaim[]>("/iod-claims"),
      api.get<Incident[]>("/incidents"),
    ]);
    setClaims(c.data);
    setIncidents(i.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/iod-claims", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/iod-claims/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("iodClaims.confirmDelete"))) return;
    await api.delete(`/iod-claims/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("iodClaims.hint")}</p>
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("iodClaims.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("iodClaims.worker")}</th>
              <th className="text-left px-4 py-2">{t("iodClaims.dateOfInjury")}</th>
              <th className="text-left px-4 py-2">{t("iodClaims.natureOfInjury")}</th>
              <th className="text-left px-4 py-2">{t("iodClaims.claimNumber")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{c.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(c.dateOfInjury).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{c.natureOfInjury}</td>
                <td className="px-4 py-2 text-mine-300">{c.claimNumber ?? "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(c)}>{t("common.edit")}</button>
                      {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("iodClaims.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("iodClaims.newTitle") : t("iodClaims.editTitle")} onClose={() => setModal(null)}>
          <ClaimForm
            workers={workers}
            incidents={incidents}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
