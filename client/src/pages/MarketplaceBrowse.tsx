import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../api/client";
import { buyerApi } from "../api/buyerClient";
import { useBuyerAuth } from "../context/BuyerAuthContext";
import { MineralListing } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import { mineralTypes } from "../lib/minerals";
import { DISPLAY_CURRENCIES, DisplayCurrency, formatCurrency, useFxRates } from "../lib/currency";

function coverImage(listing: MineralListing) {
  return listing.images.find((img) => img.isPrimary) ?? listing.images[0] ?? null;
}

function imageUrl(listing: MineralListing, imageId: string) {
  return `${API_URL}/api/minerals/${listing.id}/images/${imageId}`;
}

function Lightbox({ listing, onClose }: { listing: MineralListing; onClose: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(() => Math.max(0, listing.images.findIndex((img) => img.isPrimary)));
  const active = listing.images[index];

  return (
    <Modal title={t(`mineralTypes.${listing.mineralType}`)} onClose={onClose} size="lg">
      <div className="space-y-3">
        <div className="relative bg-mine-950 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: "20rem" }}>
          {active && <img src={imageUrl(listing, active.id)} alt="" className="max-h-[28rem] w-full object-contain" />}
          {listing.images.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                onClick={() => setIndex((i) => (i - 1 + listing.images.length) % listing.images.length)}
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                onClick={() => setIndex((i) => (i + 1) % listing.images.length)}
              >
                ›
              </button>
            </>
          )}
        </div>
        {listing.images.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto">
            {listing.images.map((img, i) => (
              <button key={img.id} type="button" onClick={() => setIndex(i)} className="shrink-0">
                <img
                  src={imageUrl(listing, img.id)}
                  alt=""
                  className={`h-14 w-14 object-cover rounded ${i === index ? "ring-2 ring-hazard-500" : "opacity-60 hover:opacity-100"}`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function FavoriteButton({ active, disabled, onToggle }: { active: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // The image it's layered over is itself a click target (opens the lightbox) —
        // without this, tapping the heart would also trigger that.
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm ${
        active ? "bg-danger-500 text-white" : "bg-black/50 text-white hover:bg-black/70"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}

function ListingCard({
  listing,
  favorited,
  canFavorite,
  onToggleFavorite,
  onBid,
  onOpenLightbox,
  displayCurrency,
  convert,
}: {
  listing: MineralListing;
  favorited: boolean;
  canFavorite: boolean;
  onToggleFavorite: () => void;
  onBid: () => void;
  onOpenLightbox: () => void;
  displayCurrency: DisplayCurrency;
  convert: (amount: number, from: string, to: string) => number | null;
}) {
  const { t } = useTranslation();
  const cover = coverImage(listing);
  const converted = listing.pricePerUnit && listing.currency !== displayCurrency ? convert(listing.pricePerUnit, listing.currency, displayCurrency) : null;

  return (
    <div className={`${cardClass} overflow-hidden flex flex-col hover:border-mine-600 transition-colors`}>
      <div
        role={cover ? "button" : undefined}
        tabIndex={cover ? 0 : undefined}
        onClick={cover ? onOpenLightbox : undefined}
        onKeyDown={cover ? (e) => (e.key === "Enter" || e.key === " ") && onOpenLightbox() : undefined}
        className={`relative bg-mine-950 aspect-[4/3] w-full group ${cover ? "cursor-pointer" : ""}`}
      >
        {cover ? (
          <img src={imageUrl(listing, cover.id)} alt={t(`mineralTypes.${listing.mineralType}`)} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-mine-700">⛏</div>
        )}
        {listing.images.length > 1 && (
          <span className="absolute bottom-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/60 text-white">
            {t("marketplace.photoCount", { count: listing.images.length })}
          </span>
        )}
        <FavoriteButton active={favorited} disabled={!canFavorite} onToggle={onToggleFavorite} />
        <span className="absolute top-2 left-2"><StatusBadge status={listing.status} /></span>
      </div>

      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">{t(`mineralTypes.${listing.mineralType}`)}</h3>
          {listing.bidCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-hazard-500/15 text-hazard-400 whitespace-nowrap">
              {t("marketplace.bidCount", { count: listing.bidCount })}
            </span>
          )}
        </div>
        <div className="text-xs text-mine-400">{listing.site?.name}{listing.grade ? ` · ${t("marketplace.grade")}: ${listing.grade}` : ""}</div>
        <div className="text-xs text-mine-300">{listing.quantity.toLocaleString()} {listing.unit} {t("marketplace.available")}</div>

        {listing.pricePerUnit != null && (
          <div>
            <div className="text-lg font-bold text-hazard-400">
              {formatCurrency(listing.pricePerUnit, listing.currency)} <span className="text-xs font-normal text-mine-400">/ {listing.unit}</span>
            </div>
            {converted != null && (
              <div className="text-[11px] text-mine-500">≈ {formatCurrency(converted, displayCurrency)} / {listing.unit}</div>
            )}
          </div>
        )}

        {listing.description && <p className="text-xs text-mine-400 line-clamp-2">{listing.description}</p>}

        <div className="flex flex-wrap gap-1">
          {listing.packaging && <span className="text-[10px] px-1.5 py-0.5 rounded bg-mine-800 text-mine-300">{listing.packaging}</span>}
          {listing.certifications && <span className="text-[10px] px-1.5 py-0.5 rounded bg-mine-800 text-mine-300">{listing.certifications}</span>}
        </div>

        <div className="pt-1 mt-auto">
          <button className={`${buttonPrimary} w-full text-xs py-2`} onClick={onBid}>
            {t("marketplace.placeBid")}
          </button>
        </div>
      </div>
    </div>
  );
}

function MineralBidForm({ listing, onDone }: { listing: MineralListing; onDone: () => void }) {
  const { t } = useTranslation();
  const { buyer } = useBuyerAuth();
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
      await buyerApi.post(`/minerals/${listing.id}/bids`, { quantity, offerPrice, notes: notes || undefined });
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

  if (!buyer) {
    return (
      <div className="text-center space-y-4 py-4">
        <p className="text-sm text-mine-300">{t("marketplace.loginRequiredToBid")}</p>
        <div className="flex justify-center gap-2">
          <Link to="/buyer-login" className={buttonPrimary}>{t("buyerLogin.signIn")}</Link>
          <Link to="/buyer-register" className={buttonSecondary}>{t("marketplace.registerAsBuyer")}</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("marketplace.bidBuyerHint", { name: buyer.legalName })}</p>
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
  const { buyer } = useBuyerAuth();
  const { convert } = useFxRates();
  const [listings, setListings] = useState<MineralListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidListing, setBidListing] = useState<MineralListing | null>(null);
  const [lightboxListing, setLightboxListing] = useState<MineralListing | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mineralType, setMineralType] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("ZAR");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<MineralListing[]>("/minerals", {
        params: {
          status: "AVAILABLE",
          search: debouncedSearch || undefined,
          mineralType: mineralType || undefined,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
          sortBy,
        },
      });
      setListings(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, mineralType, minPrice, maxPrice, sortBy]);

  useEffect(() => {
    if (!buyer) {
      setFavorites(new Set());
      return;
    }
    buyerApi.get<string[]>("/minerals/favorites").then((res) => setFavorites(new Set(res.data))).catch(() => {});
  }, [buyer]);

  async function toggleFavorite(listingId: string) {
    if (!buyer) return;
    const isFav = favorites.has(listingId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    try {
      if (isFav) await buyerApi.delete(`/minerals/${listingId}/favorite`);
      else await buyerApi.post(`/minerals/${listingId}/favorite`);
    } catch {
      // Revert on failure
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
    }
  }

  const hasFilters = search || mineralType || minPrice || maxPrice;

  return (
    <div className="min-h-screen bg-mine-950">
      <div className="border-b border-mine-800 bg-gradient-to-b from-mine-900 to-mine-950 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xl font-bold tracking-tight">⛏ Mine Guard {t("marketplace.nav")}</div>
              <p className="text-mine-300 text-sm mt-1">{t("marketplace.publicSubtitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              {buyer ? (
                <Link to="/buyer-portal" className={buttonPrimary}>{t("marketplace.myPortal")}</Link>
              ) : (
                <>
                  <Link to="/buyer-login" className={buttonSecondary}>{t("marketplace.buyerLogin")}</Link>
                  <Link to="/buyer-register" className={buttonPrimary}>{t("marketplace.registerAsBuyer")}</Link>
                </>
              )}
            </div>
          </div>

          <div className={`${cardClass} p-3 flex flex-wrap items-end gap-2`}>
            <div className="flex-1 min-w-[180px]">
              <label className={labelClass}>{t("marketplace.search")}</label>
              <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("marketplace.searchPlaceholder") ?? ""} />
            </div>
            <div className="w-44">
              <label className={labelClass}>{t("marketplace.mineralType")}</label>
              <select className={selectClass} value={mineralType} onChange={(e) => setMineralType(e.target.value)}>
                <option value="">{t("marketplace.allTypes")}</option>
                {mineralTypes.map((mt) => <option key={mt} value={mt}>{t(`mineralTypes.${mt}`)}</option>)}
              </select>
            </div>
            <div className="w-28">
              <label className={labelClass}>{t("marketplace.minPrice")}</label>
              <input className={inputClass} type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
            </div>
            <div className="w-28">
              <label className={labelClass}>{t("marketplace.maxPrice")}</label>
              <input className={inputClass} type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
            <div className="w-44">
              <label className={labelClass}>{t("marketplace.sortBy")}</label>
              <select className={selectClass} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">{t("marketplace.sortNewest")}</option>
                <option value="price_asc">{t("marketplace.sortPriceAsc")}</option>
                <option value="price_desc">{t("marketplace.sortPriceDesc")}</option>
                <option value="quantity_desc">{t("marketplace.sortQuantity")}</option>
              </select>
            </div>
            <div className="w-28">
              <label className={labelClass}>{t("marketplace.currency")}</label>
              <select className={selectClass} value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value as DisplayCurrency)}>
                {DISPLAY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {hasFilters && (
              <button
                type="button"
                className={`${buttonSecondary} text-xs`}
                onClick={() => { setSearch(""); setMineralType(""); setMinPrice(""); setMaxPrice(""); }}
              >
                {t("marketplace.clearFilters")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {loading && <div className="text-mine-300 text-center py-10">{t("common.loading")}</div>}

        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                favorited={favorites.has(l.id)}
                canFavorite={!!buyer}
                onToggleFavorite={() => toggleFavorite(l.id)}
                onBid={() => setBidListing(l)}
                onOpenLightbox={() => l.images.length > 0 && setLightboxListing(l)}
                displayCurrency={displayCurrency}
                convert={convert}
              />
            ))}
            {listings.length === 0 && (
              <div className={`${cardClass} p-10 text-center text-mine-400 sm:col-span-2 lg:col-span-3`}>
                {hasFilters ? t("marketplace.noMatchingListings") : t("marketplace.noListings")}
              </div>
            )}
          </div>
        )}
      </div>

      {bidListing && (
        <Modal title={t("marketplace.bidOn", { name: t(`mineralTypes.${bidListing.mineralType}`) })} onClose={() => setBidListing(null)}>
          <MineralBidForm listing={bidListing} onDone={() => setBidListing(null)} />
        </Modal>
      )}

      {lightboxListing && <Lightbox listing={lightboxListing} onClose={() => setLightboxListing(null)} />}
    </div>
  );
}
