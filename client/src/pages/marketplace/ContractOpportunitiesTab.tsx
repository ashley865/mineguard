import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ContractBid, ContractCategory, ContractOpportunity, ContractOpportunityStatus, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const opportunityStatuses: ContractOpportunityStatus[] = ["OPEN", "CLOSED", "AWARDED", "CANCELLED"];

export const contractCategories: ContractCategory[] = [
  "TRUCKING_HAULAGE",
  "GEOLOGICAL_SERVICES",
  "DRILLING_BLASTING",
  "EARTHMOVING_EXCAVATION",
  "PLANT_EQUIPMENT_MAINTENANCE",
  "ELECTRICAL_INSTRUMENTATION",
  "CIVIL_CONSTRUCTION",
  "ENVIRONMENTAL_REHABILITATION",
  "SECURITY_SERVICES",
  "CATERING_ACCOMMODATION",
  "TRANSPORT_LOGISTICS",
  "CONSULTING_PROFESSIONAL",
  "SUPPLY_EQUIPMENT_MATERIALS",
  "IT_TELECOMMUNICATIONS",
  "OTHER",
];

function OpportunityForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: ContractOpportunity;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [category, setCategory] = useState<ContractCategory>(initial?.category ?? "OTHER");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scopeOfWork, setScopeOfWork] = useState(initial?.scopeOfWork ?? "");
  const [budgetRange, setBudgetRange] = useState(initial?.budgetRange ?? "");
  const [submissionDeadline, setSubmissionDeadline] = useState(initial?.submissionDeadline?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<ContractOpportunityStatus>(initial?.status ?? "OPEN");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, category, title, description, scopeOfWork, budgetRange: budgetRange || undefined, submissionDeadline, status });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ContractOpportunityStatus)}>
            {opportunityStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("tenders.category")}</label>
        <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as ContractCategory)}>
          {contractCategories.map((c) => <option key={c} value={c}>{t(`tenders.categories.${c}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("marketplace.contractTitle")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("marketplace.scopeOfWork")}</label>
        <textarea className={inputClass} rows={2} value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("marketplace.budgetRange")}</label>
          <input className={inputClass} value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("marketplace.submissionDeadline")}</label>
          <DateField value={submissionDeadline} onChange={setSubmissionDeadline} required />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function BidsModal({ opportunity, onClose }: { opportunity: ContractOpportunity; onClose: () => void }) {
  const { t } = useTranslation();
  const [bids, setBids] = useState<ContractBid[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get<ContractBid[]>("/contracts/bids/list", { params: { opportunityId: opportunity.id } });
    setBids(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(id: string, decision: "SHORTLISTED" | "AWARDED" | "REJECTED") {
    await api.post(`/contracts/bids/${id}/review`, { decision });
    await load();
  }

  return (
    <Modal title={t("marketplace.bidsFor", { name: opportunity.title })} onClose={onClose}>
      {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
      {!loading && bids.length === 0 && <div className="text-mine-400 text-sm">{t("marketplace.noBids")}</div>}
      <div className="space-y-3">
        {bids.map((b) => (
          <div key={b.id} className="border border-mine-800 rounded-md p-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{b.companyName}</div>
              <StatusBadge status={b.status} />
            </div>
            <div className="text-xs text-mine-400">{b.contactName} · {b.contactEmail} · {b.contactPhone}</div>
            <div className="text-sm text-mine-300 font-semibold">{b.bidAmount}</div>
            {b.proposalNotes && <div className="text-xs text-mine-400 italic">"{b.proposalNotes}"</div>}
            {(b.status === "SUBMITTED" || b.status === "SHORTLISTED") && (
              <div className="flex gap-2 pt-1 flex-wrap">
                {b.status === "SUBMITTED" && (
                  <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => review(b.id, "SHORTLISTED")}>{t("marketplace.shortlist")}</button>
                )}
                <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => review(b.id, "AWARDED")}>{t("marketplace.award")}</button>
                <button className={buttonDanger} onClick={() => review(b.id, "REJECTED")}>{t("common.reject")}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function ContractOpportunitiesTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<ContractOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | ContractOpportunity>(null);
  const [bidsOpportunity, setBidsOpportunity] = useState<ContractOpportunity | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<ContractOpportunity[]>("/contracts");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/contracts", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/contracts/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("marketplace.confirmDeleteOpportunity"))) return;
    await api.delete(`/contracts/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("marketplace.newOpportunity")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("marketplace.contractTitle")}</th>
              <th className="text-left px-4 py-2">{t("tenders.category")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("marketplace.submissionDeadline")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.title}</td>
                <td className="px-4 py-2 text-mine-300">{t(`tenders.categories.${item.category}`)}</td>
                <td className="px-4 py-2 text-mine-300">{item.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.submissionDeadline).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setBidsOpportunity(item)}>{t("marketplace.viewBids")}</button>
                    {canEdit && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                    )}
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("marketplace.noneYetOpportunities")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("marketplace.newOpportunityTitle") : t("marketplace.editOpportunityTitle")} onClose={() => setModal(null)}>
          <OpportunityForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {bidsOpportunity && <BidsModal opportunity={bidsOpportunity} onClose={() => setBidsOpportunity(null)} />}
    </div>
  );
}
