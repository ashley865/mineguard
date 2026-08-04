import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { InventoryItem, InventoryMovement, InventoryMovementDirection, Site } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";

function ItemForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: InventoryItem;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [partNumber, setPartNumber] = useState(initial?.partNumber ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [quantityOnHand, setQuantityOnHand] = useState(initial?.quantityOnHand?.toString() ?? "0");
  const [reorderPoint, setReorderPoint] = useState(initial?.reorderPoint?.toString() ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [unitCost, setUnitCost] = useState(initial?.unitCost?.toString() ?? "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        partNumber: partNumber || undefined,
        name,
        category: category || undefined,
        quantityOnHand: initial ? undefined : Number(quantityOnHand),
        reorderPoint: reorderPoint ? Number(reorderPoint) : null,
        unit,
        unitCost: unitCost ? Number(unitCost) : null,
        supplier: supplier || undefined,
        location: location || undefined,
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
          <label className={labelClass}>{t("inventory.partNumber")}</label>
          <input className={inputClass} value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.name")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("inventory.category")}</label>
          <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("inventory.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!initial && (
          <div>
            <label className={labelClass}>{t("inventory.quantityOnHand")}</label>
            <input className={inputClass} type="number" step="any" value={quantityOnHand} onChange={(e) => setQuantityOnHand(e.target.value)} required />
          </div>
        )}
        <div>
          <label className={labelClass}>{t("inventory.reorderPoint")}</label>
          <input className={inputClass} type="number" step="any" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("inventory.unitCost")}</label>
          <input className={inputClass} type="number" step="any" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("inventory.supplier")}</label>
          <input className={inputClass} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("inventory.location")}</label>
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function MovementsModal({ item, onClose, onChanged }: { item: InventoryItem; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<InventoryMovementDirection>("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<InventoryMovement[]>("/inventory/movements", { params: { itemId: item.id } });
    setMovements(res.data);
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
      await api.post("/inventory/movements", { itemId: item.id, direction, quantity, reason: reason || undefined });
      setQuantity("");
      setReason("");
      await load();
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("inventory.movementError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("inventory.movementsFor", { name: item.name })} onClose={onClose}>
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end flex-wrap border border-mine-800 rounded-md p-3">
          <div>
            <label className={labelClass}>{t("inventory.direction")}</label>
            <select className={selectClass} value={direction} onChange={(e) => setDirection(e.target.value as InventoryMovementDirection)}>
              <option value="IN">{t("inventory.stockIn")}</option>
              <option value="OUT">{t("inventory.stockOut")}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("inventory.quantity")}</label>
            <input className={`${inputClass} w-28`} type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className={labelClass}>{t("inventory.reason")}</label>
            <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
        </form>
        {error && <div className="text-danger-500 text-xs">{error}</div>}

        {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
        {!loading && movements.length === 0 && <div className="text-mine-400 text-sm">{t("inventory.noMovements")}</div>}
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {movements.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
              <span className={m.direction === "IN" ? "text-success-500" : "text-danger-500"}>
                {m.direction === "IN" ? "+" : "-"}{m.quantity} {item.unit}
              </span>
              <span className="text-mine-400">{m.reason ?? "—"}</span>
              <span className="text-mine-400">{m.performedBy?.name}</span>
              <span className="text-mine-500">{new Date(m.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function InventoryManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modal, setModal] = useState<null | "create" | InventoryItem>(null);
  const [movementsItem, setMovementsItem] = useState<InventoryItem | null>(null);

  async function load() {
    setLoading(true);
    const [i, s] = await Promise.all([
      api.get<InventoryItem[]>("/inventory/items", { params: lowStockOnly ? { lowStock: "true" } : undefined }),
      api.get<Site[]>("/sites"),
    ]);
    setItems(i.data);
    setSites(s.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowStockOnly]);

  async function create(data: any) {
    await api.post("/inventory/items", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/inventory/items/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("inventory.confirmDelete"))) return;
    await api.delete(`/inventory/items/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("inventory.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("inventory.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("inventory.newItem")}</button>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-mine-300">
        <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
        {t("inventory.lowStockOnly")}
      </label>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("common.name")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("inventory.category")}</th>
              <th className="text-left px-4 py-2">{t("inventory.quantityOnHand")}</th>
              <th className="text-left px-4 py-2">{t("inventory.reorderPoint")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const low = item.reorderPoint != null && item.quantityOnHand <= item.reorderPoint;
              return (
                <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{item.name}{item.partNumber ? ` (${item.partNumber})` : ""}</td>
                  <td className="px-4 py-2 text-mine-300">{item.site?.name}</td>
                  <td className="px-4 py-2 text-mine-300">{item.category ?? "—"}</td>
                  <td className={`px-4 py-2 ${low ? "text-danger-500 font-semibold" : "text-mine-300"}`}>
                    {item.quantityOnHand} {item.unit}
                  </td>
                  <td className="px-4 py-2 text-mine-300">{item.reorderPoint ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setMovementsItem(item)}>{t("inventory.movements")}</button>
                      {canEdit && (
                        <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      )}
                      {canDelete && (
                        <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("inventory.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("inventory.newItemTitle") : t("inventory.editItemTitle")} onClose={() => setModal(null)}>
          <ItemForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {movementsItem && <MovementsModal item={movementsItem} onClose={() => setMovementsItem(null)} onChanged={load} />}
    </div>
  );
}
