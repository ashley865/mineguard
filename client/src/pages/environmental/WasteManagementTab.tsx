import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Site, WasteDisposalMethod, WasteStream, WasteType } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import StatTile from "../plant/StatTile";

const wasteTypes: WasteType[] = ["HAZARDOUS", "GENERAL", "RECYCLABLE"];
const statuses = ["ACTIVE", "DECOMMISSIONED"] as const;
const disposalMethods: WasteDisposalMethod[] = ["LANDFILL", "INCINERATION", "RECYCLING", "TREATMENT", "RECOVERY", "OTHER"];

// Legal accumulation ceiling for hazardous waste without a stockpile permit
// (NEMWA Waste Classification and Management Regulations, Norm 4).
const DEFAULT_HAZARDOUS_STORAGE_LIMIT_MONTHS = 23;

function monthsSince(iso?: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / (30.44 * 24 * 60 * 60 * 1000);
}

function StreamForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: WasteStream;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [wasteType, setWasteType] = useState<WasteType>(initial?.wasteType ?? "GENERAL");
  const [classificationCode, setClassificationCode] = useState(initial?.classificationCode ?? "");
  const [sourceActivity, setSourceActivity] = useState(initial?.sourceActivity ?? "");
  const [storageLocation, setStorageLocation] = useState(initial?.storageLocation ?? "");
  const [storageCapacity, setStorageCapacity] = useState(initial?.storageCapacity?.toString() ?? "");
  const [storageCapacityUnit, setStorageCapacityUnit] = useState(initial?.storageCapacityUnit ?? "");
  const [storageLimitMonths, setStorageLimitMonths] = useState(
    initial?.storageLimitMonths?.toString() ?? (initial ? "" : String(DEFAULT_HAZARDOUS_STORAGE_LIMIT_MONTHS))
  );
  const [status, setStatus] = useState<(typeof statuses)[number]>(initial?.status ?? "ACTIVE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        name,
        wasteType,
        classificationCode: classificationCode || undefined,
        sourceActivity: sourceActivity || undefined,
        storageLocation: storageLocation || undefined,
        storageCapacity: storageCapacity ? Number(storageCapacity) : null,
        storageCapacityUnit: storageCapacityUnit || undefined,
        storageLimitMonths: storageLimitMonths ? Number(storageLimitMonths) : null,
        status,
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
          <label className={labelClass}>{t("environmentalRegisters.waste.name")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.wasteType")}</label>
          <select
            className={selectClass}
            value={wasteType}
            onChange={(e) => {
              const v = e.target.value as WasteType;
              setWasteType(v);
              if (v === "HAZARDOUS" && !storageLimitMonths) setStorageLimitMonths(String(DEFAULT_HAZARDOUS_STORAGE_LIMIT_MONTHS));
            }}
          >
            {wasteTypes.map((v) => <option key={v} value={v}>{t(`environmentalRegisters.waste.types.${v}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.classificationCode")}</label>
          <input className={inputClass} value={classificationCode} onChange={(e) => setClassificationCode(e.target.value)} placeholder="UN 3082" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.sourceActivity")}</label>
          <input className={inputClass} value={sourceActivity} onChange={(e) => setSourceActivity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.storageLocation")}</label>
          <input className={inputClass} value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.storageCapacity")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={storageCapacity} onChange={(e) => setStorageCapacity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.storageCapacityUnit")}</label>
          <input className={inputClass} value={storageCapacityUnit} onChange={(e) => setStorageCapacityUnit(e.target.value)} placeholder="m³ / drums" />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.storageLimitMonths")}</label>
          <input className={inputClass} type="number" min={0} max={600} value={storageLimitMonths} onChange={(e) => setStorageLimitMonths(e.target.value)} />
        </div>
      </div>
      {wasteType === "HAZARDOUS" && (
        <p className="text-xs text-mine-400">{t("environmentalRegisters.waste.hazardousStorageHint", { months: DEFAULT_HAZARDOUS_STORAGE_LIMIT_MONTHS })}</p>
      )}
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as (typeof statuses)[number])}>
          {statuses.map((s) => <option key={s} value={s}>{t(`environmentalRegisters.waste.statuses.${s}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ManifestForm({ stream, onSubmit, onCancel }: {
  stream: WasteStream;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [manifestNumber, setManifestNumber] = useState("");
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState(stream.storageCapacityUnit ?? "");
  const [transporterName, setTransporterName] = useState("");
  const [transporterRegistrationNumber, setTransporterRegistrationNumber] = useState("");
  const [disposalFacilityName, setDisposalFacilityName] = useState("");
  const [disposalFacilityLicenceNumber, setDisposalFacilityLicenceNumber] = useState("");
  const [disposalMethod, setDisposalMethod] = useState<WasteDisposalMethod>("LANDFILL");
  const [receivedConfirmationDate, setReceivedConfirmationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        manifestNumber,
        dispatchDate,
        quantity: Number(quantity),
        quantityUnit,
        transporterName: transporterName || undefined,
        transporterRegistrationNumber: transporterRegistrationNumber || undefined,
        disposalFacilityName,
        disposalFacilityLicenceNumber: disposalFacilityLicenceNumber || undefined,
        disposalMethod,
        receivedConfirmationDate: receivedConfirmationDate || null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("environmentalRegisters.waste.manifestHint", { name: stream.name })}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.manifestNumber")}</label>
          <input className={inputClass} value={manifestNumber} onChange={(e) => setManifestNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.dispatchDate")}</label>
          <DateField value={dispatchDate} onChange={setDispatchDate} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.quantity")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.quantityUnit")}</label>
          <input className={inputClass} value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} required placeholder="tonnes / litres" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.transporterName")}</label>
          <input className={inputClass} value={transporterName} onChange={(e) => setTransporterName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.transporterRegistrationNumber")}</label>
          <input className={inputClass} value={transporterRegistrationNumber} onChange={(e) => setTransporterRegistrationNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.disposalFacilityName")}</label>
          <input className={inputClass} value={disposalFacilityName} onChange={(e) => setDisposalFacilityName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.disposalFacilityLicenceNumber")}</label>
          <input className={inputClass} value={disposalFacilityLicenceNumber} onChange={(e) => setDisposalFacilityLicenceNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.disposalMethod")}</label>
          <select className={selectClass} value={disposalMethod} onChange={(e) => setDisposalMethod(e.target.value as WasteDisposalMethod)}>
            {disposalMethods.map((m) => <option key={m} value={m}>{t(`environmentalRegisters.waste.disposalMethods.${m}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.waste.receivedConfirmationDate")}</label>
          <DateField value={receivedConfirmationDate} onChange={setReceivedConfirmationDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function WasteManagementTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [streams, setStreams] = useState<WasteStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | WasteStream>(null);
  const [manifestModal, setManifestModal] = useState<WasteStream | null>(null);
  const [historyFor, setHistoryFor] = useState<WasteStream | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<WasteStream[]>("/waste-management/streams");
      setStreams(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = streams.filter((s) => s.status === "ACTIVE");
    const hazardous = active.filter((s) => s.wasteType === "HAZARDOUS");
    const hazardousOverLimit = hazardous.filter((s) => {
      const months = monthsSince(s.storageStartDate);
      return s.storageLimitMonths != null && months != null && months > s.storageLimitMonths;
    });
    const noManifests = active.filter((s) => !s.manifests || s.manifests.length === 0);
    return {
      active: active.length,
      hazardous: hazardous.length,
      hazardousOverLimit: hazardousOverLimit.length,
      noManifests: noManifests.length,
    };
  }, [streams]);

  async function create(data: any) {
    await api.post("/waste-management/streams", data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/waste-management/streams/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("environmentalRegisters.waste.confirmDelete"))) return;
    await api.delete(`/waste-management/streams/${id}`);
    await load();
  }
  async function addManifest(id: string, data: any) {
    await api.post(`/waste-management/streams/${id}/manifests`, data);
    setManifestModal(null);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<WasteStream>[] = [
    { key: "name", header: t("environmentalRegisters.waste.name"), render: (s) => s.name, sortValue: (s) => s.name },
    { key: "wasteType", header: t("environmentalRegisters.waste.wasteType"), render: (s) => t(`environmentalRegisters.waste.types.${s.wasteType}`), sortValue: (s) => s.wasteType },
    { key: "site", header: t("common.site"), render: (s) => s.site?.name ?? "—", sortValue: (s) => s.site?.name ?? "" },
    { key: "classificationCode", header: t("environmentalRegisters.waste.classificationCode"), render: (s) => s.classificationCode || "—", sortValue: (s) => s.classificationCode ?? "" },
    {
      key: "storageAge",
      header: t("environmentalRegisters.waste.storageAgeShort"),
      render: (s) => {
        const months = monthsSince(s.storageStartDate);
        if (months == null) return <span className="text-hazard-500">{t("environmentalRegisters.notSet")}</span>;
        const overLimit = s.storageLimitMonths != null && months > s.storageLimitMonths;
        return (
          <span className={overLimit ? "text-danger-500 font-semibold" : "text-mine-200"}>
            {t("environmentalRegisters.waste.monthsInStorage", { count: Math.floor(months) })}
            {s.storageLimitMonths != null ? ` / ${s.storageLimitMonths}` : ""}
          </span>
        );
      },
      sortValue: (s) => monthsSince(s.storageStartDate) ?? -1,
    },
    { key: "lastManifest", header: t("environmentalRegisters.waste.lastDispatch"), render: (s) => (s.manifests?.[0] ? new Date(s.manifests[0].dispatchDate).toLocaleDateString() : "—"), sortValue: (s) => s.manifests?.[0]?.dispatchDate ?? "" },
    { key: "status", header: t("common.status"), render: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label={t("environmentalRegisters.waste.statActive")} value={stats.active} target={t("environmentalRegisters.waste.statActiveTarget")} />
        <StatTile label={t("environmentalRegisters.waste.statHazardous")} value={stats.hazardous} target={t("environmentalRegisters.waste.statHazardousTarget")} />
        <StatTile
          label={t("environmentalRegisters.waste.statOverLimit")}
          value={stats.hazardousOverLimit}
          target={t("environmentalRegisters.targetZero")}
          tone={stats.hazardousOverLimit === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("environmentalRegisters.waste.statNoManifests")}
          value={stats.noManifests}
          target={t("environmentalRegisters.targetZero")}
          tone={stats.noManifests === 0 ? "good" : "warn"}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("environmentalRegisters.waste.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("environmentalRegisters.waste.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("environmentalRegisters.waste.newStream")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={streams}
          rowKey={(s) => s.id}
          emptyMessage={t("environmentalRegisters.waste.noneYet")}
          searchValue={(s) => `${s.name} ${s.classificationCode ?? ""} ${s.sourceActivity ?? ""}`}
          exportFilename="waste-streams"
          exportColumns={[
            { header: t("environmentalRegisters.waste.name"), value: (s) => s.name },
            { header: t("environmentalRegisters.waste.wasteType"), value: (s) => s.wasteType },
            { header: t("common.site"), value: (s) => s.site?.name ?? "" },
            { header: t("environmentalRegisters.waste.classificationCode"), value: (s) => s.classificationCode ?? "" },
            { header: t("common.status"), value: (s) => s.status },
          ]}
          actions={(s) => (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryFor(s)}>{t("environmentalRegisters.waste.manifests")}</button>
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setManifestModal(s)}>{t("environmentalRegisters.waste.logDispatch")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(s)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(s.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("environmentalRegisters.waste.newStreamTitle") : t("environmentalRegisters.waste.editStreamTitle")} onClose={() => setFormModal(null)}>
          <StreamForm
            sites={sites}
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(data) => (formModal === "create" ? create(data) : update(formModal.id, data))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}

      {manifestModal && (
        <Modal title={t("environmentalRegisters.waste.logDispatch")} onClose={() => setManifestModal(null)}>
          <ManifestForm stream={manifestModal} onSubmit={(data) => addManifest(manifestModal.id, data)} onCancel={() => setManifestModal(null)} />
        </Modal>
      )}

      {historyFor && (
        <Modal title={t("environmentalRegisters.waste.manifestsTitle", { name: historyFor.name })} onClose={() => setHistoryFor(null)}>
          {historyFor.manifests && historyFor.manifests.length > 0 ? (
            <ul className="space-y-3">
              {historyFor.manifests.map((m) => (
                <li key={m.id} className="border-b border-mine-800 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-mine-100">{m.manifestNumber}</span>
                    <span className="text-xs text-mine-300">{t(`environmentalRegisters.waste.disposalMethods.${m.disposalMethod}`)}</span>
                  </div>
                  <p className="text-xs text-mine-400">
                    {new Date(m.dispatchDate).toLocaleDateString()} · {m.quantity.toLocaleString()} {m.quantityUnit} · {m.disposalFacilityName}
                  </p>
                  {!m.receivedConfirmationDate && (
                    <p className="text-xs text-hazard-500 mt-1">{t("environmentalRegisters.waste.awaitingConfirmation")}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mine-400">{t("environmentalRegisters.waste.noManifestsYet")}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
