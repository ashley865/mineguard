import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../api/client";
import { MineralListing } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonPrimary, cardClass, inputClass, labelClass } from "../components/ui";

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

export default function MarketplaceBrowse() {
  const { t } = useTranslation();
  const [listings, setListings] = useState<MineralListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidListing, setBidListing] = useState<MineralListing | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<MineralListing[]>("/minerals", { params: { status: "AVAILABLE" } });
    setListings(res.data);
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
        {loading && <div className="text-mine-300">{t("common.loading")}</div>}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listings.map((l) => (
              <div key={l.id} className={`${cardClass} overflow-hidden`}>
                {l.images.length > 0 && (
                  <div className="flex gap-1 overflow-x-auto bg-mine-950">
                    {l.images.map((img) => (
                      <img
                        key={img.id}
                        src={`${API_URL}/api/minerals/${l.id}/images/${img.id}`}
                        alt={l.mineralType}
                        className="h-32 w-32 object-cover shrink-0"
                      />
                    ))}
                  </div>
                )}
                <div className="p-5 space-y-2">
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
                  {l.packaging && <div className="text-xs text-mine-400">{t("marketplace.packaging")}: {l.packaging}</div>}
                  {l.certifications && <div className="text-xs text-mine-400">{t("marketplace.certifications")}: {l.certifications}</div>}
                  <button className={`${buttonPrimary} text-xs px-3 py-1.5`} onClick={() => setBidListing(l)}>
                    {t("marketplace.placeBid")}
                  </button>
                </div>
              </div>
            ))}
            {listings.length === 0 && (
              <div className={`${cardClass} p-6 text-center text-mine-400 md:col-span-2`}>{t("marketplace.noListings")}</div>
            )}
          </div>
        )}
      </div>

      {bidListing && (
        <Modal title={t("marketplace.bidOn", { name: bidListing.mineralType })} onClose={() => setBidListing(null)}>
          <MineralBidForm listing={bidListing} onDone={() => setBidListing(null)} />
        </Modal>
      )}
    </div>
  );
}
