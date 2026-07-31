import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { ContractOpportunity, MineralListing } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

function MineralBidForm({ listing, onDone }: { listing: MineralListing; onDone: () => void }) {
  const { t } = useTranslation();
  const [buyerEmail, setBuyerEmail] = useState("");
  const [quantity, setQuantity] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/minerals/${listing.id}/bids`, { buyerEmail, quantity, offerPrice, notes: notes || undefined });
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
      <p className="text-xs text-mine-400">{t("marketplace.bidBuyerHint")}</p>
      <div>
        <label className={labelClass}>{t("marketplace.buyerEmail")}</label>
        <input className={inputClass} type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("marketplace.bidQuantity", { unit: listing.unit })}</label>
          <input className={inputClass} type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("marketplace.offerPrice")}</label>
          <input className={inputClass} type="number" step="any" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <button type="submit" className={`${buttonPrimary} w-full`} disabled={submitting}>
        {submitting ? t("common.saving") : t("marketplace.submitBid")}
      </button>
    </form>
  );
}

function ContractBidForm({ opportunity, onDone }: { opportunity: ContractOpportunity; onDone: () => void }) {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [proposalNotes, setProposalNotes] = useState("");
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
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <button type="submit" className={`${buttonPrimary} w-full`} disabled={submitting}>
        {submitting ? t("common.saving") : t("marketplace.submitBid")}
      </button>
    </form>
  );
}

export default function MarketplaceBrowse() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"minerals" | "contracts">("minerals");
  const [listings, setListings] = useState<MineralListing[]>([]);
  const [opportunities, setOpportunities] = useState<ContractOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidListing, setBidListing] = useState<MineralListing | null>(null);
  const [bidOpportunity, setBidOpportunity] = useState<ContractOpportunity | null>(null);

  async function load() {
    setLoading(true);
    const [l, o] = await Promise.all([
      api.get<MineralListing[]>("/minerals", { params: { status: "AVAILABLE" } }),
      api.get<ContractOpportunity[]>("/contracts", { params: { status: "OPEN" } }),
    ]);
    setListings(l.data);
    setOpportunities(o.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-mine-950">
      <div className="border-b border-mine-800 bg-mine-900 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-lg font-bold tracking-tight">⛏ Mine Guard {t("marketplace.nav")}</div>
            <p className="text-mine-300 text-sm">{t("marketplace.publicSubtitle")}</p>
          </div>
          <Link to="/buyer-register" className={buttonPrimary}>{t("marketplace.registerAsBuyer")}</Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex gap-2">
          <button className={tab === "minerals" ? buttonPrimary : buttonSecondary} onClick={() => setTab("minerals")}>
            {t("marketplace.tabMinerals")}
          </button>
          <button className={tab === "contracts" ? buttonPrimary : buttonSecondary} onClick={() => setTab("contracts")}>
            {t("marketplace.tabContracts")}
          </button>
        </div>

        {loading && <div className="text-mine-300">{t("common.loading")}</div>}

        {!loading && tab === "minerals" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listings.map((l) => (
              <div key={l.id} className={`${cardClass} p-5 space-y-2`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{l.mineralType}</h3>
                  <StatusBadge status={l.status} />
                </div>
                <div className="text-xs text-mine-400">{l.site?.name}{l.grade ? ` · ${t("marketplace.grade")}: ${l.grade}` : ""}</div>
                <div className="text-sm text-mine-300">
                  {l.quantity} {l.unit}
                  {l.pricePerUnit ? ` · ${l.currency} ${l.pricePerUnit} / ${l.unit}` : ""}
                </div>
                {l.description && <p className="text-xs text-mine-400">{l.description}</p>}
                <button className={`${buttonPrimary} text-xs px-3 py-1.5`} onClick={() => setBidListing(l)}>
                  {t("marketplace.placeBid")}
                </button>
              </div>
            ))}
            {listings.length === 0 && (
              <div className={`${cardClass} p-6 text-center text-mine-400 md:col-span-2`}>{t("marketplace.noListings")}</div>
            )}
          </div>
        )}

        {!loading && tab === "contracts" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {opportunities.map((o) => (
              <div key={o.id} className={`${cardClass} p-5 space-y-2`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{o.title}</h3>
                  <StatusBadge status={o.status} />
                </div>
                <div className="text-xs text-mine-400">
                  {o.site?.name} · {t("marketplace.deadline")}: {new Date(o.submissionDeadline).toLocaleDateString()}
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

      {bidListing && (
        <Modal title={t("marketplace.bidOn", { name: bidListing.mineralType })} onClose={() => setBidListing(null)}>
          <MineralBidForm listing={bidListing} onDone={() => setBidListing(null)} />
        </Modal>
      )}

      {bidOpportunity && (
        <Modal title={t("marketplace.bidOn", { name: bidOpportunity.title })} onClose={() => setBidOpportunity(null)}>
          <ContractBidForm opportunity={bidOpportunity} onDone={() => setBidOpportunity(null)} />
        </Modal>
      )}
    </div>
  );
}
