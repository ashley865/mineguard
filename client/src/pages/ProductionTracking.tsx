import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { MineralType, OreGradeUnit, ProductionRecord, ProductionShift, Site, Zone } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import { mineralTypes } from "../lib/minerals";
import LoadError from "../components/LoadError";

const shifts: ProductionShift[] = ["DAY", "AFTERNOON", "NIGHT"];
const oreGradeUnits: OreGradeUnit[] = ["PERCENT", "GRAMS_PER_TONNE", "OUNCES_PER_TONNE", "CARATS_PER_TONNE", "PARTS_PER_MILLION"];

function ProductionForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: ProductionRecord;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [shiftDate, setShiftDate] = useState(initial?.shiftDate?.slice(0, 10) ?? "");
  const [shift, setShift] = useState<ProductionShift>(initial?.shift ?? "DAY");
  const [mineralType, setMineralType] = useState<MineralType>(initial?.mineralType ?? "GOLD");
  const [tonnesMined, setTonnesMined] = useState(initial?.tonnesMined?.toString() ?? "");
  const [tonnesProcessed, setTonnesProcessed] = useState(initial?.tonnesProcessed?.toString() ?? "");
  const [oreGrade, setOreGrade] = useState(initial?.oreGrade?.toString() ?? "");
  const [oreGradeUnit, setOreGradeUnit] = useState<OreGradeUnit>(initial?.oreGradeUnit ?? "GRAMS_PER_TONNE");
  const [recoveryRate, setRecoveryRate] = useState(initial?.recoveryRate?.toString() ?? "");
  const [wasteRemoved, setWasteRemoved] = useState(initial?.wasteRemoved?.toString() ?? "");
  const [targetTonnes, setTargetTonnes] = useState(initial?.targetTonnes?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        shiftDate,
        shift,
        mineralType,
        tonnesMined: Number(tonnesMined),
        tonnesProcessed: tonnesProcessed ? Number(tonnesProcessed) : null,
        oreGrade: oreGrade ? Number(oreGrade) : null,
        oreGradeUnit: oreGrade ? oreGradeUnit : null,
        recoveryRate: recoveryRate ? Number(recoveryRate) : null,
        wasteRemoved: wasteRemoved ? Number(wasteRemoved) : null,
        targetTonnes: targetTonnes ? Number(targetTonnes) : null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("production.mineralType")}</label>
        <select className={selectClass} value={mineralType} onChange={(e) => setMineralType(e.target.value as MineralType)}>
          {mineralTypes.map((mt) => <option key={mt} value={mt}>{t(`mineralTypes.${mt}`)}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("production.shiftDate")}</label>
          <DateField value={shiftDate} onChange={setShiftDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("production.shift")}</label>
          <select className={selectClass} value={shift} onChange={(e) => setShift(e.target.value as ProductionShift)}>
            {shifts.map((s) => <option key={s} value={s}>{t(`production.shifts.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("production.tonnesMined")}</label>
          <input className={inputClass} type="number" step="any" value={tonnesMined} onChange={(e) => setTonnesMined(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("production.targetTonnes")}</label>
          <input className={inputClass} type="number" step="any" value={targetTonnes} onChange={(e) => setTargetTonnes(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("production.tonnesProcessed")}</label>
          <input className={inputClass} type="number" step="any" value={tonnesProcessed} onChange={(e) => setTonnesProcessed(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("production.wasteRemoved")}</label>
          <input className={inputClass} type="number" step="any" value={wasteRemoved} onChange={(e) => setWasteRemoved(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("production.recoveryRate")}</label>
          <input className={inputClass} type="number" step="any" min="0" max="100" value={recoveryRate} onChange={(e) => setRecoveryRate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("production.oreGrade")}</label>
          <input className={inputClass} type="number" step="any" value={oreGrade} onChange={(e) => setOreGrade(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("production.oreGradeUnit")}</label>
          <select className={selectClass} value={oreGradeUnit} onChange={(e) => setOreGradeUnit(e.target.value as OreGradeUnit)}>
            {oreGradeUnits.map((u) => <option key={u} value={u}>{t(`production.oreGradeUnits.${u}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function ProductionTracking() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | ProductionRecord>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [r, s, z] = await Promise.all([
        api.get<ProductionRecord[]>("/production"),
        api.get<Site[]>("/sites"),
        api.get<Zone[]>("/zones"),
      ]);
      setRecords(r.data);
      setSites(s.data);
      setZones(z.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/production", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/production/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("production.confirmDelete"))) return;
    await api.delete(`/production/${id}`);
    await load();
  }

  const totalTonnes = records.reduce((sum, r) => sum + r.tonnesMined, 0);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("production.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("production.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("production.newRecord")}</button>
        )}
      </div>

      <div className={`${cardClass} p-4 flex items-center gap-2`}>
        <span className="text-mine-400 text-xs uppercase">{t("production.totalTonnes")}</span>
        <span className="text-lg font-bold">{totalTonnes.toLocaleString()}</span>
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("production.shiftDate")}</th>
              <th className="text-left px-4 py-2">{t("production.shift")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("production.mineralType")}</th>
              <th className="text-left px-4 py-2">{t("production.tonnesMined")}</th>
              <th className="text-left px-4 py-2">{t("production.tonnesProcessed")}</th>
              <th className="text-left px-4 py-2">{t("production.oreGrade")}</th>
              <th className="text-left px-4 py-2">{t("production.recoveryRate")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(r.shiftDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{t(`production.shifts.${r.shift}`)}</td>
                <td className="px-4 py-2 text-mine-300">{r.site?.name}{r.zone?.name ? ` · ${r.zone.name}` : ""}</td>
                <td className="px-4 py-2 text-mine-300">{t(`mineralTypes.${r.mineralType}`)}</td>
                <td className="px-4 py-2 text-mine-300">
                  {r.tonnesMined.toLocaleString()}{r.targetTonnes ? ` / ${r.targetTonnes.toLocaleString()}` : ""}
                </td>
                <td className="px-4 py-2 text-mine-300">{r.tonnesProcessed?.toLocaleString() ?? "—"}</td>
                <td className="px-4 py-2 text-mine-300">
                  {r.oreGrade != null ? `${r.oreGrade} ${r.oreGradeUnit ? t(`production.oreGradeUnitsShort.${r.oreGradeUnit}`) : ""}` : "—"}
                </td>
                <td className="px-4 py-2 text-mine-300">{r.recoveryRate != null ? `${r.recoveryRate}%` : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {canEdit && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(r)}>{t("common.edit")}</button>
                    )}
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-mine-400">{t("production.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("production.newRecordTitle") : t("production.editRecordTitle")} onClose={() => setModal(null)}>
          <ProductionForm
            sites={sites}
            zones={zones}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
