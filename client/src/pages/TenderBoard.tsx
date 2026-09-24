import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { ContractCategory, ContractOpportunity } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { contractCategories } from "./marketplace/ContractOpportunitiesTab";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import { LogoMark, Wordmark } from "../components/Logo";
import Honeypot from "../components/Honeypot";
import TurnstileWidget from "../components/TurnstileWidget";

function ContractBidForm({ opportunity, onDone }: { opportunity: ContractOpportunity; onDone: () => void }) {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [proposalNotes, setProposalNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/contracts/${opportunity.id}/bids`, {
        companyName,
        contactName,
        contactPhone,
        contactEmail,
        bidAmount,
        proposalNotes: proposalNotes || undefined,
        website,
        turnstileToken: turnstileToken || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("marketplace.bidError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-sm text-mine-300">{t("marketplace.bidSubmitted")}</p>
        <button className={buttonPrimary} onClick={onDone}>{t("common.close")}</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Honeypot value={website} onChange={setWebsite} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("marketplace.companyName")}</label>
          <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.contactName")}</label>
          <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.phone")}</label>
          <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.contactEmail")}</label>
          <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("marketplace.bidAmount")}</label>
        <input className={inputClass} type="number" step="any" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("marketplace.proposalNotes")}</label>
        <textarea className={inputClass} rows={3} value={proposalNotes} onChange={(e) => setProposalNotes(e.target.value)} />
      </div>
      <TurnstileWidget onToken={setTurnstileToken} />

      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <button type="submit" className={`${buttonPrimary} w-full`} disabled={submitting}>
        {submitting ? t("common.saving") : t("marketplace.submitBid")}
      </button>
    </form>
  );
}

export default function TenderBoard() {
  const { t } = useTranslation();
  const [opportunities, setOpportunities] = useState<ContractOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ContractCategory | "ALL">("ALL");
  const [vendorMineId, setVendorMineId] = useState("");
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [bidOpportunity, setBidOpportunity] = useState<ContractOpportunity | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<ContractOpportunity[]>("/contracts", {
      params: { status: "OPEN", category: category === "ALL" ? undefined : category, mineId: vendorMineId || undefined },
    });
    setOpportunities(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, vendorMineId]);

  // Same reasoning as MarketplaceBrowse.tsx: the vendor filter's options come from every
  // open opportunity, unfiltered, so picking one doesn't shrink the dropdown itself.
  useEffect(() => {
    api.get<ContractOpportunity[]>("/contracts", { params: { status: "OPEN" } }).then((res) => {
      const byId = new Map<string, string>();
      for (const o of res.data) {
        if (o.site?.mine) byId.set(o.site.mine.id, o.site.mine.name);
      }
      setVendors([...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  return (
    <div className="min-h-screen bg-mine-950">
      <div className="border-b border-mine-800 bg-mine-900 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-lg font-bold tracking-tight flex items-center gap-2"><LogoMark size={20} /><Wordmark /> {t("tenders.nav")}</div>
          <p className="text-mine-300 text-sm">{t("tenders.publicSubtitle")}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex gap-2 flex-wrap">
          <button
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              category === "ALL" ? "bg-hazard-500 text-white border-hazard-500" : "border-mine-700 text-mine-300 hover:bg-mine-800"
            }`}
            onClick={() => setCategory("ALL")}
          >
            {t("tenders.allCategories")}
          </button>
          {contractCategories.map((c) => (
            <button
              key={c}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                category === c ? "bg-hazard-500 text-white border-hazard-500" : "border-mine-700 text-mine-300 hover:bg-mine-800"
              }`}
              onClick={() => setCategory(c)}
            >
              {t(`tenders.categories.${c}`)}
            </button>
          ))}
        </div>

        <div className="w-56">
          <label className={labelClass}>{t("marketplace.vendor")}</label>
          <select className={selectClass} value={vendorMineId} onChange={(e) => setVendorMineId(e.target.value)}>
            <option value="">{t("marketplace.allVendors")}</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {loading && <div className="text-mine-300">{t("common.loading")}</div>}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {opportunities.map((o) => (
              <div key={o.id} className={`${cardClass} p-5 space-y-2`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{o.title}</h3>
                  <StatusBadge status={o.status} />
                </div>
                <div className="text-xs text-mine-400">
                  {t(`tenders.categories.${o.category}`)} · <span className="font-semibold text-mine-300">{o.site?.mine?.name ?? o.site?.name}</span>
                  {o.site?.mine && o.site.name !== o.site.mine.name ? ` (${o.site.name})` : ""} · {t("marketplace.deadline")}: {new Date(o.submissionDeadline).toLocaleDateString()}
                </div>
                <p className="text-xs text-mine-400">{o.description}</p>
                {o.budgetRange && <div className="text-xs text-mine-400">{t("marketplace.budgetRange")}: {o.budgetRange}</div>}
                <button className={`${buttonPrimary} text-xs px-3 py-1.5`} onClick={() => setBidOpportunity(o)}>
                  {t("marketplace.submitBid")}
                </button>
              </div>
            ))}
            {opportunities.length === 0 && (
              <div className={`${cardClass} p-6 text-center text-mine-400 md:col-span-2`}>{t("marketplace.noOpportunities")}</div>
            )}
          </div>
        )}
      </div>

      {bidOpportunity && (
        <Modal title={t("marketplace.bidOn", { name: bidOpportunity.title })} onClose={() => setBidOpportunity(null)}>
          <ContractBidForm opportunity={bidOpportunity} onDone={() => setBidOpportunity(null)} />
        </Modal>
      )}
    </div>
  );
}
