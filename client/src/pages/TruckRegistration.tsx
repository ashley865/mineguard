import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Delivery, DeliveryDirection, Site, Truck } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";
import FleetTracking from "./FleetTracking";

type TabKey = "trucks" | "deliveries" | "fleet";

function TruckForm({ initial, onSubmit, onCancel }: {
  initial?: Truck;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? "");
  const [vehicleType, setVehicleType] = useState(initial?.vehicleType ?? "");
  const [driverName, setDriverName] = useState(initial?.driverName ?? "");
  const [driverLicense, setDriverLicense] = useState(initial?.driverLicense ?? "");
  const [driverPhone, setDriverPhone] = useState(initial?.driverPhone ?? "");
  const [haulierCompany, setHaulierCompany] = useState(initial?.haulierCompany ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        registrationNumber,
        vehicleType: vehicleType || undefined,
        driverName,
        driverLicense: driverLicense || undefined,
        driverPhone: driverPhone || undefined,
        haulierCompany: haulierCompany || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("trucks.registrationNumber")}</label>
          <input className={inputClass} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("trucks.vehicleType")}</label>
          <input className={inputClass} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder={t("trucks.vehicleTypePlaceholder") ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("trucks.driverName")}</label>
          <input className={inputClass} value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("trucks.driverLicense")}</label>
          <input className={inputClass} value={driverLicense} onChange={(e) => setDriverLicense(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.phone")}</label>
          <input className={inputClass} value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("trucks.haulierCompany")}</label>
          <input className={inputClass} value={haulierCompany} onChange={(e) => setHaulierCompany(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DeliveryForm({ trucks, sites, onSubmit, onCancel }: {
  trucks: Truck[];
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [truckId, setTruckId] = useState(trucks[0]?.id ?? "");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [direction, setDirection] = useState<DeliveryDirection>("INBOUND");
  const [cargoType, setCargoType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        truckId,
        siteId,
        direction,
        cargoType,
        quantity: quantity ? Number(quantity) : undefined,
        unit: unit || undefined,
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
          <label className={labelClass}>{t("trucks.nav")}</label>
          <select className={inputClass} value={truckId} onChange={(e) => setTruckId(e.target.value)} required>
            {trucks.map((tr) => <option key={tr.id} value={tr.id}>{tr.registrationNumber} — {tr.driverName}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("trucks.direction")}</label>
        <select className={inputClass} value={direction} onChange={(e) => setDirection(e.target.value as DeliveryDirection)}>
          <option value="INBOUND">{t("trucks.inbound")}</option>
          <option value="OUTBOUND">{t("trucks.outbound")}</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("trucks.cargoType")}</label>
        <input className={inputClass} value={cargoType} onChange={(e) => setCargoType(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("trucks.quantity")}</label>
          <input className={inputClass} type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("trucks.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t("trucks.unitPlaceholder") ?? ""} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("trucks.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving || !truckId || !siteId}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function TruckRegistration() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";

  const [tab, setTab] = useState<TabKey>("deliveries");
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [truckModal, setTruckModal] = useState<null | "create" | Truck>(null);
  const [deliveryModal, setDeliveryModal] = useState(false);

  async function load() {
    setLoading(true);
    const [t1, s, d] = await Promise.all([
      api.get<Truck[]>("/trucks"),
      api.get<Site[]>("/sites"),
      api.get<Delivery[]>("/trucks/deliveries/list"),
    ]);
    setTrucks(t1.data);
    setSites(s.data);
    setDeliveries(d.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createTruck(data: any) {
    await api.post("/trucks", data);
    setTruckModal(null);
    await load();
  }

  async function updateTruck(id: string, data: any) {
    await api.put(`/trucks/${id}`, data);
    setTruckModal(null);
    await load();
  }

  async function deleteTruck(id: string) {
    if (!confirm(t("trucks.confirmDeleteTruck"))) return;
    await api.delete(`/trucks/${id}`);
    await load();
  }

  async function createDelivery(data: any) {
    await api.post("/trucks/deliveries", data);
    setDeliveryModal(false);
    await load();
  }

  async function checkoutDelivery(id: string) {
    await api.post(`/trucks/deliveries/${id}/checkout`);
    await load();
  }

  async function deleteDelivery(id: string) {
    if (!confirm(t("trucks.confirmDeleteDelivery"))) return;
    await api.delete(`/trucks/deliveries/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("trucks.loading")}</div>;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "deliveries", label: t("trucks.tabDeliveries") },
    { key: "trucks", label: t("trucks.tabTrucks") },
    { key: "fleet", label: t("fleet.nav") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("trucks.title")}</h1>
        <p className="text-mine-300 text-sm">{t("trucks.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button key={tb.key} className={tab === tb.key ? buttonPrimary : buttonSecondary} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "deliveries" && (
        <div className="space-y-4">
          {canEdit && trucks.length > 0 && sites.length > 0 && (
            <div className="flex justify-end">
              <button className={buttonPrimary} onClick={() => setDeliveryModal(true)}>{t("trucks.newDelivery")}</button>
            </div>
          )}
          {canEdit && trucks.length === 0 && (
            <div className={`${cardClass} p-4 text-sm text-mine-300`}>{t("trucks.registerTruckFirst")}</div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("trucks.colTruck")}</th>
                  <th className="text-left px-4 py-2">{t("common.site")}</th>
                  <th className="text-left px-4 py-2">{t("trucks.direction")}</th>
                  <th className="text-left px-4 py-2">{t("trucks.cargoType")}</th>
                  <th className="text-left px-4 py-2">{t("visitors.colCheckIn")}</th>
                  <th className="text-left px-4 py-2">{t("common.status")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                    <td className="px-4 py-2 font-medium">
                      {d.truck?.registrationNumber}
                      <div className="text-xs text-mine-400">{d.truck?.driverName}</div>
                    </td>
                    <td className="px-4 py-2 text-mine-300">{d.site?.name}</td>
                    <td className="px-4 py-2 text-mine-300">{d.direction === "INBOUND" ? t("trucks.inbound") : t("trucks.outbound")}</td>
                    <td className="px-4 py-2 text-mine-300">
                      {d.cargoType}{d.quantity ? ` · ${d.quantity}${d.unit ? ` ${d.unit}` : ""}` : ""}
                    </td>
                    <td className="px-4 py-2 text-mine-300">{new Date(d.checkInAt).toLocaleString()}</td>
                    <td className="px-4 py-2"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {canEdit && d.status === "CHECKED_IN" && (
                          <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => checkoutDelivery(d.id)}>
                            {t("trucks.checkOut")}
                          </button>
                        )}
                        {canDelete && (
                          <button className={buttonDanger} onClick={() => deleteDelivery(d.id)}>{t("common.delete")}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {deliveries.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("trucks.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "trucks" && (
        <div className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <button className={buttonPrimary} onClick={() => setTruckModal("create")}>{t("trucks.newTruck")}</button>
            </div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("trucks.registrationNumber")}</th>
                  <th className="text-left px-4 py-2">{t("trucks.driverName")}</th>
                  <th className="text-left px-4 py-2">{t("trucks.haulierCompany")}</th>
                  <th className="text-left px-4 py-2">{t("trucks.vehicleType")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {trucks.map((tr) => (
                  <tr key={tr.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                    <td className="px-4 py-2 font-medium">{tr.registrationNumber}</td>
                    <td className="px-4 py-2 text-mine-300">{tr.driverName}</td>
                    <td className="px-4 py-2 text-mine-300">{tr.haulierCompany || "—"}</td>
                    <td className="px-4 py-2 text-mine-300">{tr.vehicleType || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-2">
                          <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setTruckModal(tr)}>{t("common.edit")}</button>
                          {canDelete && <button className={buttonDanger} onClick={() => deleteTruck(tr.id)}>{t("common.delete")}</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {trucks.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("trucks.noneYetTrucks")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "fleet" && <FleetTracking />}

      {truckModal && (
        <Modal title={truckModal === "create" ? t("trucks.newTruckTitle") : t("trucks.editTruckTitle")} onClose={() => setTruckModal(null)}>
          <TruckForm
            initial={truckModal === "create" ? undefined : truckModal}
            onSubmit={(data) => (truckModal === "create" ? createTruck(data) : updateTruck(truckModal.id, data))}
            onCancel={() => setTruckModal(null)}
          />
        </Modal>
      )}

      {deliveryModal && (
        <Modal title={t("trucks.newDeliveryTitle")} onClose={() => setDeliveryModal(false)}>
          <DeliveryForm trucks={trucks} sites={sites} onSubmit={createDelivery} onCancel={() => setDeliveryModal(false)} />
        </Modal>
      )}
    </div>
  );
}
