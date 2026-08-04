import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { FleetPosition, Site, Truck } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

function PositionForm({ trucks, sites, onSubmit, onCancel }: {
  trucks: Truck[];
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [truckId, setTruckId] = useState(trucks[0]?.id ?? "");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [speedKmh, setSpeedKmh] = useState("");
  const [heading, setHeading] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        truckId,
        siteId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        speedKmh: speedKmh ? Number(speedKmh) : null,
        heading: heading ? Number(heading) : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("fleet.truck")}</label>
          <select className={inputClass} value={truckId} onChange={(e) => setTruckId(e.target.value)}>
            {trucks.map((tr) => <option key={tr.id} value={tr.id}>{tr.registrationNumber} — {tr.driverName}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("fleet.latitude")}</label>
          <input className={inputClass} type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("fleet.longitude")}</label>
          <input className={inputClass} type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("fleet.speed")}</label>
          <input className={inputClass} type="number" step="any" value={speedKmh} onChange={(e) => setSpeedKmh(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("fleet.heading")}</label>
          <input className={inputClass} type="number" step="any" value={heading} onChange={(e) => setHeading(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function HistoryModal({ truck, onClose }: { truck: Truck; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [positions, setPositions] = useState<FleetPosition[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get<FleetPosition[]>("/fleet", { params: { truckId: truck.id } });
    setPositions(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(id: string) {
    await api.delete(`/fleet/${id}`);
    await load();
  }

  return (
    <Modal title={t("fleet.historyFor", { name: truck.registrationNumber })} onClose={onClose}>
      {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
      {!loading && positions.length === 0 && <div className="text-mine-400 text-sm">{t("fleet.noHistory")}</div>}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {positions.map((p) => (
          <div key={p.id} className="border border-mine-800 rounded-md p-3 flex items-center justify-between text-xs">
            <div>
              <div className="text-mine-100">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</div>
              <div className="text-mine-400">
                {p.site?.name} · {p.speedKmh != null ? `${p.speedKmh} km/h` : "—"} · {new Date(p.createdAt).toLocaleString()}
              </div>
            </div>
            {canDelete && (
              <button className={buttonDanger} onClick={() => remove(p.id)}>{t("common.delete")}</button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function FleetTracking() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canLog = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [latest, setLatest] = useState<FleetPosition[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [logModal, setLogModal] = useState(false);
  const [historyTruck, setHistoryTruck] = useState<Truck | null>(null);

  async function load() {
    setLoading(true);
    const [l, tr, s] = await Promise.all([
      api.get<FleetPosition[]>("/fleet/latest"),
      api.get<Truck[]>("/trucks"),
      api.get<Site[]>("/sites"),
    ]);
    setLatest(l.data);
    setTrucks(tr.data);
    setSites(s.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function logPosition(data: any) {
    await api.post("/fleet", data);
    setLogModal(false);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end flex-wrap gap-3">
        {canLog && trucks.length > 0 && (
          <button className={buttonPrimary} onClick={() => setLogModal(true)}>{t("fleet.logPosition")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("fleet.truck")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("fleet.coordinates")}</th>
              <th className="text-left px-4 py-2">{t("fleet.speed")}</th>
              <th className="text-left px-4 py-2">{t("fleet.lastUpdated")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {latest.map((p) => (
              <tr key={p.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{p.truck?.registrationNumber}</td>
                <td className="px-4 py-2 text-mine-300">{p.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</td>
                <td className="px-4 py-2 text-mine-300">{p.speedKmh != null ? `${p.speedKmh} km/h` : "—"}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(p.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  {p.truck && (
                    <button
                      className="text-xs text-mine-300 hover:text-mine-50"
                      onClick={() => setHistoryTruck(trucks.find((t) => t.id === p.truckId) ?? null)}
                    >
                      {t("fleet.viewHistory")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {latest.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("fleet.noPositions")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {logModal && (
        <Modal title={t("fleet.logPositionTitle")} onClose={() => setLogModal(false)}>
          <PositionForm trucks={trucks} sites={sites} onSubmit={logPosition} onCancel={() => setLogModal(false)} />
        </Modal>
      )}

      {historyTruck && <HistoryModal truck={historyTruck} onClose={() => setHistoryTruck(null)} />}
    </div>
  );
}
