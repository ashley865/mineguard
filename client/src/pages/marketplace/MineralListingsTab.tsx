import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { MineralBid, MineralListing, MineralListingStatus, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";

const listingStatuses: MineralListingStatus[] = ["AVAILABLE", "SOLD", "WITHDRAWN"];

function ImageManager({ listing, onChanged }: { listing: MineralListing; onChanged: (updated: MineralListing) => void }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!pending || pending.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      Array.from(pending).forEach((f) => form.append("images", f));
      const res = await api.post<MineralListing>(`/minerals/${listing.id}/images`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChanged(res.data);
      setPending(null);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("marketplace.imageUploadError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(imageId: string) {
    setBusy(true);
    try {
      await api.delete(`/minerals/${listing.id}/images/${imageId}`);
      onChanged({ ...listing, images: listing.images.filter((img) => img.id !== imageId) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border border-mine-800 rounded-md p-3 bg-mine-900/40">
      <div className="text-xs font-semibold text-mine-300 uppercase">{t("marketplace.images")}</div>
      {listing.images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {listing.images.map((img) => (
            <div key={img.id} className="relative">
              <img
                src={`${API_URL}/api/minerals/${listing.id}/images/${img.id}`}
                alt={img.fileName}
                className="h-16 w-16 object-cover rounded-md border border-mine-800"
              />
              <button
                type="button"
                className="absolute -top-1.5 -right-1.5 bg-danger-500 text-white rounded-full w-5 h-5 text-xs leading-none"
                onClick={() => remove(img.id)}
                disabled={busy}
                aria-label={t("common.delete") ?? ""}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className={`${inputClass} text-xs`}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setPending(e.target.files)}
        />
        <button type="button" className={`${buttonSecondary} text-xs px-3`} onClick={upload} disabled={busy || !pending}>
          {t("marketplace.uploadImages")}
        </button>
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
    </div>
  );
}

function ListingForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: MineralListing;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [mineralType, setMineralType] = useState(initial?.mineralType ?? "");
  const [grade, setGrade] = useState(initial?.grade ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity?.toString() ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [pricePerUnit, setPricePerUnit] = useState(initial?.pricePerUnit?.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "ZAR");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [packaging, setPackaging] = useState(initial?.packaging ?? "");
  const [certifications, setCertifications] = useState(initial?.certifications ?? "");
  const [status, setStatus] = useState<MineralListingStatus>(initial?.status ?? "AVAILABLE");
  const [listing, setListing] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        mineralType,
        grade: grade || undefined,
        quantity: Number(quantity),
        unit,
        pricePerUnit: pricePerUnit ? Number(pricePerUnit) : null,
        currency,
        description: description || undefined,
        packaging: packaging || undefined,
        certifications: certifications || undefined,
        status,
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
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("marketplace.mineralType")}</label>
          <input className={inputClass} value={mineralType} onChange={(e) => setMineralType(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("marketplace.grade")}</label>
          <input className={inputClass} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as MineralListingStatus)}>
            {listingStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("marketplace.quantity")}</label>
          <input className={inputClass} type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("marketplace.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t("trucks.unitPlaceholder") ?? ""} required />
        </div>
        <div>
          <label className={labelClass}>{t("marketplace.currency")}</label>
          <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("marketplace.pricePerUnit")}</label>
        <input className={inputClass} type="number" step="any" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("marketplace.packaging")}</label>
          <input className={inputClass} value={packaging} onChange={(e) => setPackaging(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("marketplace.certifications")}</label>
          <input className={inputClass} value={certifications} onChange={(e) => setCertifications(e.target.value)} />
        </div>
      </div>
      {listing ? (
        <ImageManager listing={listing} onChanged={setListing} />
      ) : (
        <p className="text-xs text-mine-400">{t("marketplace.imagesAfterSaveHint")}</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function BidsModal({ listing, onClose }: { listing: MineralListing; onClose: () => void }) {
  const { t } = useTranslation();
  const [bids, setBids] = useState<MineralBid[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get<MineralBid[]>("/minerals/bids/list", { params: { listingId: listing.id } });
    setBids(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(id: string, decision: "ACCEPTED" | "REJECTED") {
    await api.post(`/minerals/bids/${id}/review`, { decision });
    await load();
  }

  return (
    <Modal title={t("marketplace.bidsFor", { name: listing.mineralType })} onClose={onClose}>
      {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
      {!loading && bids.length === 0 && <div className="text-mine-400 text-sm">{t("marketplace.noBids")}</div>}
      <div className="space-y-3">
        {bids.map((b) => (
          <div key={b.id} className="border border-mine-800 rounded-md p-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{b.buyer?.legalName}</div>
              <StatusBadge status={b.status} />
            </div>
            <div className="text-xs text-mine-400">{b.buyer?.contactEmail}</div>
            <div className="text-sm text-mine-300">
              {b.quantity} {listing.unit} · {listing.currency} {b.offerPrice}
            </div>
            {b.notes && <div className="text-xs text-mine-400 italic">"{b.notes}"</div>}
            {b.status === "PENDING" && (
              <div className="flex gap-2 pt-1">
                <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => review(b.id, "ACCEPTED")}>{t("common.approve")}</button>
                <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => review(b.id, "REJECTED")}>{t("common.reject")}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function MineralListingsTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<MineralListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | MineralListing>(null);
  const [bidsListing, setBidsListing] = useState<MineralListing | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<MineralListing[]>("/minerals");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/minerals", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/minerals/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("marketplace.confirmDeleteListing"))) return;
    await api.delete(`/minerals/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("marketplace.newListing")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("marketplace.mineralType")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("marketplace.quantity")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.mineralType}{item.grade ? ` (${item.grade})` : ""}</td>
                <td className="px-4 py-2 text-mine-300">{item.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{item.quantity} {item.unit}</td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setBidsListing(item)}>{t("marketplace.viewBids")}</button>
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
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("marketplace.noneYetListings")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("marketplace.newListingTitle") : t("marketplace.editListingTitle")} onClose={() => setModal(null)}>
          <ListingForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {bidsListing && <BidsModal listing={bidsListing} onClose={() => setBidsListing(null)} />}
    </div>
  );
}
