import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ExplosivesMagazine, ExplosivesMagazineStatus, ExplosivesTransaction, ExplosivesTransactionType, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

const magazineStatuses: ExplosivesMagazineStatus[] = ["ACTIVE", "SUSPENDED", "EXPIRED"];
const transactionTypes: ExplosivesTransactionType[] = ["RECEIPT", "ISSUE", "RETURN", "DESTRUCTION"];

function MagazineForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: ExplosivesMagazine;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [magazineNumber, setMagazineNumber] = useState(initial?.magazineNumber ?? "");
  const [licenseNumber, setLicenseNumber] = useState(initial?.licenseNumber ?? "");
  const [licenseExpiry, setLicenseExpiry] = useState(initial?.licenseExpiry?.slice(0, 10) ?? "");
  const [capacity, setCapacity] = useState(initial?.capacity?.toString() ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "kg");
  const [status, setStatus] = useState<ExplosivesMagazineStatus>(initial?.status ?? "ACTIVE");
  const [lastInspectionDate, setLastInspectionDate] = useState(initial?.lastInspectionDate?.slice(0, 10) ?? "");
  const [nextInspectionDue, setNextInspectionDue] = useState(initial?.nextInspectionDue?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        magazineNumber,
        licenseNumber,
        licenseExpiry,
        capacity: Number(capacity),
        unit,
        status,
        lastInspectionDate: lastInspectionDate || null,
        nextInspectionDue: nextInspectionDue || null,
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
          <select className={inputClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("explosives.magazineNumber")}</label>
          <input className={inputClass} value={magazineNumber} onChange={(e) => setMagazineNumber(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("explosives.licenseNumber")}</label>
          <input className={inputClass} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("explosives.licenseExpiry")}</label>
          <input className={inputClass} type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("explosives.capacity")}</label>
          <input className={inputClass} type="number" step="any" value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("inventory.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ExplosivesMagazineStatus)}>
            {magazineStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("explosives.lastInspectionDate")}</label>
          <input className={inputClass} type="date" value={lastInspectionDate} onChange={(e) => setLastInspectionDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("explosives.nextInspectionDue")}</label>
          <input className={inputClass} type="date" value={nextInspectionDue} onChange={(e) => setNextInspectionDue(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function TransactionsModal({ magazine, onClose, onChanged }: { magazine: ExplosivesMagazine; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<ExplosivesTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionType, setTransactionType] = useState<ExplosivesTransactionType>("RECEIPT");
  const [explosiveType, setExplosiveType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<ExplosivesTransaction[]>("/explosives/transactions", { params: { magazineId: magazine.id } });
    setTransactions(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/explosives/transactions", {
        magazineId: magazine.id,
        transactionType,
        explosiveType,
        quantity,
        issuedTo: issuedTo || undefined,
      });
      setExplosiveType("");
      setQuantity("");
      setIssuedTo("");
      await load();
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("explosives.transactionError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("explosives.transactionsFor", { name: magazine.magazineNumber })} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-xs text-mine-400">
          {t("explosives.currentStock")}: <span className="text-mine-100 font-semibold">{magazine.currentStock} {magazine.unit}</span> / {magazine.capacity} {magazine.unit}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 border border-mine-800 rounded-md p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("explosives.transactionType")}</label>
              <select className={inputClass} value={transactionType} onChange={(e) => setTransactionType(e.target.value as ExplosivesTransactionType)}>
                {transactionTypes.map((tt) => <option key={tt} value={tt}>{t(`explosives.transactionTypes.${tt}`)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("explosives.explosiveType")}</label>
              <input className={inputClass} value={explosiveType} onChange={(e) => setExplosiveType(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("inventory.quantity")}</label>
              <input className={inputClass} type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("explosives.issuedTo")}</label>
              <input className={inputClass} value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} />
            </div>
          </div>
          {error && <div className="text-danger-500 text-xs">{error}</div>}
          <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
        </form>

        {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
        {!loading && transactions.length === 0 && <div className="text-mine-400 text-sm">{t("explosives.noTransactions")}</div>}
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
              <span>{t(`explosives.transactionTypes.${tx.transactionType}`)} — {tx.explosiveType}</span>
              <span className="text-mine-300">{tx.quantity} {magazine.unit}</span>
              <span className="text-mine-400">{tx.issuedTo ?? "—"}</span>
              <span className="text-mine-500">{new Date(tx.transactionDate).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function ExplosivesRegister() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [magazines, setMagazines] = useState<ExplosivesMagazine[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | ExplosivesMagazine>(null);
  const [transactionsMagazine, setTransactionsMagazine] = useState<ExplosivesMagazine | null>(null);

  async function load() {
    setLoading(true);
    const [m, s] = await Promise.all([
      api.get<ExplosivesMagazine[]>("/explosives/magazines"),
      api.get<Site[]>("/sites"),
    ]);
    setMagazines(m.data);
    setSites(s.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/explosives/magazines", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/explosives/magazines/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("explosives.confirmDelete"))) return;
    await api.delete(`/explosives/magazines/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("explosives.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("explosives.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("explosives.newMagazine")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("explosives.magazineNumber")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("explosives.currentStock")}</th>
              <th className="text-left px-4 py-2">{t("explosives.licenseExpiry")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {magazines.map((m) => (
              <tr key={m.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{m.magazineNumber}</td>
                <td className="px-4 py-2 text-mine-300">{m.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{m.currentStock} / {m.capacity} {m.unit}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(m.licenseExpiry).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={m.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setTransactionsMagazine(m)}>{t("explosives.transactions")}</button>
                    {canEdit && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(m)}>{t("common.edit")}</button>
                    )}
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(m.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {magazines.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("explosives.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("explosives.newMagazineTitle") : t("explosives.editMagazineTitle")} onClose={() => setModal(null)}>
          <MagazineForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {transactionsMagazine && (
        <TransactionsModal magazine={transactionsMagazine} onClose={() => setTransactionsMagazine(null)} onChanged={load} />
      )}
    </div>
  );
}
