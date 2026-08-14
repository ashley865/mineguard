import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PurchaseOrder, PurchaseOrderStatus, Site, Supplier, SupplierStatus } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import DataTable, { DataTableColumn } from "../components/DataTable";
import SummaryCards from "../components/SummaryCards";
import { AuditHistoryButton } from "../components/AuditHistoryPanel";

const supplierStatuses: SupplierStatus[] = ["ACTIVE", "INACTIVE", "BLACKLISTED"];
const orderStatuses: PurchaseOrderStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "RECEIVED", "CANCELLED"];

function SupplierForm({ initial, onSubmit, onCancel }: {
  initial?: Supplier;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [bbbeeLevel, setBbbeeLevel] = useState(initial?.bbbeeLevel ?? "");
  const [status, setStatus] = useState<SupplierStatus>(initial?.status ?? "ACTIVE");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        name,
        registrationNumber: registrationNumber || undefined,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        category: category || undefined,
        bbbeeLevel: bbbeeLevel || undefined,
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
          <label className={labelClass}>{t("common.name")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.registrationNumber")}</label>
          <input className={inputClass} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("contractors.contactName")}</label>
          <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.contactEmail")}</label>
          <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.phone")}</label>
          <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("inventory.category")}</label>
          <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("buyerRegister.bbbeeLevel")}</label>
          <input className={inputClass} value={bbbeeLevel} onChange={(e) => setBbbeeLevel(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as SupplierStatus)}>
            {supplierStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function OrderForm({ sites, suppliers, onSubmit, onCancel }: {
  sites: Site[];
  suppliers: Supplier[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [orderNumber, setOrderNumber] = useState("");
  const [description, setDescription] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [lines, setLines] = useState([{ itemDescription: "", quantity: "1", unitPrice: "0" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateLine(i: number, field: string, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { itemDescription: "", quantity: "1", unitPrice: "0" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        supplierId,
        orderNumber,
        description,
        expectedDeliveryDate: expectedDeliveryDate || null,
        lines: lines.map((l) => ({ itemDescription: l.itemDescription, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("procurement.createError"));
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
          <label className={labelClass}>{t("procurement.supplier")}</label>
          <select className={selectClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("procurement.orderNumber")}</label>
          <input className={inputClass} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("procurement.expectedDeliveryDate")}</label>
          <DateField value={expectedDeliveryDate} onChange={setExpectedDeliveryDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>

      <div className="space-y-2 border border-mine-800 rounded-md p-3">
        <div className="text-xs font-semibold text-mine-300 uppercase">{t("procurement.lineItems")}</div>
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className={labelClass}>{t("procurement.itemDescription")}</label>
              <input className={inputClass} value={l.itemDescription} onChange={(e) => updateLine(i, "itemDescription", e.target.value)} required />
            </div>
            <div className="w-20">
              <label className={labelClass}>{t("inventory.quantity")}</label>
              <input className={inputClass} type="number" step="any" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} required />
            </div>
            <div className="w-24">
              <label className={labelClass}>{t("marketplace.pricePerUnit")}</label>
              <input className={inputClass} type="number" step="any" value={l.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)} required />
            </div>
            {lines.length > 1 && (
              <button type="button" className={buttonDanger} onClick={() => removeLine(i)}>{t("common.delete")}</button>
            )}
          </div>
        ))}
        <button type="button" className={`${buttonSecondary} text-xs px-3`} onClick={addLine}>{t("procurement.addLine")}</button>
        <div className="text-sm font-semibold text-right pt-1">{t("procurement.total")}: {total.toLocaleString()}</div>
      </div>

      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function SuppliersTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | Supplier>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<Supplier[]>("/procurement/suppliers");
    setSuppliers(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/procurement/suppliers", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/procurement/suppliers/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("procurement.confirmDeleteSupplier"))) return;
    await api.delete(`/procurement/suppliers/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("procurement.newSupplier")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "name", header: t("common.name"), render: (s) => <span className="font-medium">{s.name}</span>, sortValue: (s) => s.name },
            { key: "category", header: t("inventory.category"), render: (s) => s.category ?? "—", sortValue: (s) => s.category ?? "" },
            { key: "email", header: t("contractors.contactEmail"), render: (s) => s.contactEmail ?? "—", sortValue: (s) => s.contactEmail ?? "" },
            { key: "status", header: t("common.status"), render: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
          ] as DataTableColumn<Supplier>[]
        }
        rows={suppliers}
        rowKey={(s) => s.id}
        emptyMessage={t("procurement.noneYetSuppliers")}
        searchValue={(s) => `${s.name} ${s.category ?? ""}`}
        actions={(s) => (
          <div className="flex justify-end gap-2">
            {canEdit && (
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(s)}>{t("common.edit")}</button>
            )}
            {canDelete && (
              <button className={buttonDanger} onClick={() => remove(s.id)}>{t("common.delete")}</button>
            )}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("procurement.newSupplierTitle") : t("procurement.editSupplierTitle")} onClose={() => setModal(null)}>
          <SupplierForm
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal title={order.orderNumber} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <span className="text-mine-400 text-xs">{order.supplier?.name} · {order.site?.name}</span>
        </div>
        <p className="text-mine-200">{order.description}</p>
        <div className="space-y-1">
          {order.lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
              <span>{l.itemDescription}</span>
              <span className="text-mine-400">{l.quantity} × {l.unitPrice}</span>
              <span className="font-semibold">{l.lineTotal.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="text-right font-bold border-t border-mine-800 pt-2">
          {t("procurement.total")}: {order.currency} {order.totalAmount.toLocaleString()}
        </div>
      </div>
    </Modal>
  );
}

function OrdersTab({ sites, suppliers, canEdit, canApprove, canDelete }: {
  sites: Site[];
  suppliers: Supplier[];
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<PurchaseOrder[]>("/procurement/orders");
    setOrders(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/procurement/orders", data);
    setModal(false);
    await load();
  }

  async function approve(id: string) {
    await api.post(`/procurement/orders/${id}/approve`);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("procurement.confirmDeleteOrder"))) return;
    await api.delete(`/procurement/orders/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  const pendingApprovalCount = orders.filter((o) => o.status === "SUBMITTED").length;

  return (
    <div className="space-y-4">
      {canApprove && (
        <SummaryCards cards={[{ label: t("procurement.summaryPendingApproval"), value: pendingApprovalCount, tone: pendingApprovalCount > 0 ? "hazard" : "default" }]} />
      )}

      {canEdit && sites.length > 0 && suppliers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("procurement.newOrder")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "number", header: t("procurement.orderNumber"), render: (o) => <button className="font-medium hover:underline" onClick={() => setDetailOrder(o)}>{o.orderNumber}</button>, sortValue: (o) => o.orderNumber },
            { key: "supplier", header: t("procurement.supplier"), render: (o) => o.supplier?.name ?? "—", sortValue: (o) => o.supplier?.name ?? "" },
            { key: "site", header: t("common.site"), render: (o) => o.site?.name ?? "—", sortValue: (o) => o.site?.name ?? "" },
            { key: "total", header: t("procurement.total"), render: (o) => `${o.currency} ${o.totalAmount.toLocaleString()}`, sortValue: (o) => o.totalAmount },
            { key: "status", header: t("common.status"), render: (o) => <StatusBadge status={o.status} />, sortValue: (o) => o.status },
          ] as DataTableColumn<PurchaseOrder>[]
        }
        rows={orders}
        rowKey={(o) => o.id}
        emptyMessage={t("procurement.noneYetOrders")}
        searchValue={(o) => `${o.orderNumber} ${o.supplier?.name ?? ""}`}
        exportFilename="purchase-orders"
        exportColumns={[
          { header: t("procurement.orderNumber"), value: (o) => o.orderNumber },
          { header: t("procurement.supplier"), value: (o) => o.supplier?.name ?? "" },
          { header: t("common.site"), value: (o) => o.site?.name ?? "" },
          { header: t("procurement.total"), value: (o) => o.totalAmount },
          { header: t("common.status"), value: (o) => o.status },
        ]}
        actions={(o) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="PurchaseOrder" entityId={o.id} />
            {canApprove && o.status !== "APPROVED" && o.status !== "CANCELLED" && (
              <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => approve(o.id)}>{t("common.approve")}</button>
            )}
            {canDelete && (
              <button className={buttonDanger} onClick={() => remove(o.id)}>{t("common.delete")}</button>
            )}
          </div>
        )}
      />
      {modal && (
        <Modal title={t("procurement.newOrderTitle")} onClose={() => setModal(false)}>
          <OrderForm sites={sites} suppliers={suppliers} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
      {detailOrder && <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />}
    </div>
  );
}

export default function Procurement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canApprove = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "orders" || tabParam === "suppliers" ? tabParam : "suppliers";
  const [tab, setTab] = useState<"suppliers" | "orders">(initialTab);
  const [sites, setSites] = useState<Site[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Site[]>("/sites"), api.get<Supplier[]>("/procurement/suppliers")]).then(([s, sup]) => {
      setSites(s.data);
      setSuppliers(sup.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("procurement.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("procurement.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={tab === "suppliers" ? buttonPrimary : buttonSecondary} onClick={() => setTab("suppliers")}>
          {t("procurement.tabSuppliers")}
        </button>
        <button className={tab === "orders" ? buttonPrimary : buttonSecondary} onClick={() => setTab("orders")}>
          {t("procurement.tabOrders")}
        </button>
      </div>

      {tab === "suppliers" && <SuppliersTab canEdit={canEdit} canDelete={canDelete} />}
      {tab === "orders" && (
        <OrdersTab sites={sites} suppliers={suppliers} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} />
      )}
    </div>
  );
}
