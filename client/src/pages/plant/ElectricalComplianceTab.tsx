import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  ElectricalInstallation,
  ElectricalInstallationStatus,
  ElectricalInstallationType,
  ElectricalTestResult,
  ElectricalTestType,
  ExProtectionType,
  Site,
  Zone,
} from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import DueDate, { isOverdue } from "./DueDate";
import StatTile from "./StatTile";

const installationTypes: ElectricalInstallationType[] = [
  "SUBSTATION",
  "TRANSFORMER",
  "SWITCHGEAR",
  "DISTRIBUTION_BOARD",
  "MOTOR_CONTROL_CENTRE",
  "CABLE_RETICULATION",
  "EARTH_LEAKAGE_UNIT",
  "GENERATOR",
  "OTHER",
];
const exTypes: ExProtectionType[] = [
  "NONE",
  "FLAMEPROOF_D",
  "INCREASED_SAFETY_E",
  "INTRINSICALLY_SAFE_I",
  "PRESSURIZED_P",
  "ENCAPSULATION_M",
  "NON_SPARKING_N",
  "DUST_PROTECTION_T",
  "OTHER",
];
const statuses: ElectricalInstallationStatus[] = ["IN_SERVICE", "ISOLATED", "UNDER_REPAIR", "DECOMMISSIONED"];
const testTypes: ElectricalTestType[] = ["EARTH_CONTINUITY", "EARTH_LEAKAGE", "INSULATION_RESISTANCE", "POLARITY", "EX_INSPECTION", "THERMOGRAPHIC"];
const testResults: ElectricalTestResult[] = ["PASS", "MARGINAL", "FAIL"];

function InstallationForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: ElectricalInstallation;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [installationType, setInstallationType] = useState<ElectricalInstallationType>(initial?.installationType ?? "DISTRIBUTION_BOARD");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [voltageRating, setVoltageRating] = useState(initial?.voltageRating ?? "");
  const [hazardousArea, setHazardousArea] = useState(initial?.hazardousArea ?? false);
  const [exProtection, setExProtection] = useState<ExProtectionType>(initial?.exProtection ?? "NONE");
  const [exCertificateNumber, setExCertificateNumber] = useState(initial?.exCertificateNumber ?? "");
  const [exCertificateExpiry, setExCertificateExpiry] = useState(initial?.exCertificateExpiry?.slice(0, 10) ?? "");
  const [earthLeakageProtected, setEarthLeakageProtected] = useState(initial?.earthLeakageProtected ?? false);
  const [cocNumber, setCocNumber] = useState(initial?.cocNumber ?? "");
  const [cocIssuedDate, setCocIssuedDate] = useState(initial?.cocIssuedDate?.slice(0, 10) ?? "");
  const [lastTestDate, setLastTestDate] = useState(initial?.lastTestDate?.slice(0, 10) ?? "");
  const [nextTestDue, setNextTestDue] = useState(initial?.nextTestDue?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<ElectricalInstallationStatus>(initial?.status ?? "IN_SERVICE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const siteZones = zones.filter((z) => z.siteId === siteId);
  // The hazardous-area flag and the Ex technique only mean something together, so
  // flag the combination that is actually dangerous rather than validating each alone.
  const unprotectedInHazardousArea = hazardousArea && exProtection === "NONE";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        identifier,
        installationType,
        description: description || undefined,
        location: location || undefined,
        voltageRating: voltageRating || undefined,
        hazardousArea,
        exProtection,
        exCertificateNumber: exCertificateNumber || undefined,
        exCertificateExpiry: exCertificateExpiry || null,
        earthLeakageProtected,
        cocNumber: cocNumber || undefined,
        cocIssuedDate: cocIssuedDate || null,
        lastTestDate: lastTestDate || null,
        nextTestDue: nextTestDue || null,
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
          <label className={labelClass}>{t("plantIntegrity.electrical.identifier")}</label>
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.type")}</label>
          <select className={selectClass} value={installationType} onChange={(e) => setInstallationType(e.target.value as ElectricalInstallationType)}>
            {installationTypes.map((v) => <option key={v} value={v}>{t(`plantIntegrity.electrical.types.${v}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select
            className={selectClass}
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setZoneId("");
            }}
            required
          >
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("plantIntegrity.electrical.noZone")}</option>
            {siteZones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.voltageRating")}</label>
          <input className={inputClass} value={voltageRating} onChange={(e) => setVoltageRating(e.target.value)} placeholder="11 kV" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.description")}</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.location")}</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3 bg-mine-900/40 border border-mine-800 rounded-xl p-4">
        <label className="flex items-center gap-2 text-sm text-mine-200">
          <input type="checkbox" checked={hazardousArea} onChange={(e) => setHazardousArea(e.target.checked)} />
          {t("plantIntegrity.electrical.hazardousArea")}
        </label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>{t("plantIntegrity.electrical.exProtection")}</label>
            <select className={selectClass} value={exProtection} onChange={(e) => setExProtection(e.target.value as ExProtectionType)}>
              {exTypes.map((v) => <option key={v} value={v}>{t(`plantIntegrity.electrical.exTypes.${v}`)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("plantIntegrity.electrical.exCertificateNumber")}</label>
            <input className={inputClass} value={exCertificateNumber} onChange={(e) => setExCertificateNumber(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("plantIntegrity.electrical.exCertificateExpiry")}</label>
            <DateField value={exCertificateExpiry} onChange={setExCertificateExpiry} />
          </div>
        </div>
        {unprotectedInHazardousArea && <p className="text-xs text-danger-500">{t("plantIntegrity.electrical.unprotectedWarning")}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-mine-200 pb-2">
            <input type="checkbox" checked={earthLeakageProtected} onChange={(e) => setEarthLeakageProtected(e.target.checked)} />
            {t("plantIntegrity.electrical.earthLeakageProtected")}
          </label>
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.cocNumber")}</label>
          <input className={inputClass} value={cocNumber} onChange={(e) => setCocNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.cocIssuedDate")}</label>
          <DateField value={cocIssuedDate} onChange={setCocIssuedDate} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.lastTestDate")}</label>
          <DateField value={lastTestDate} onChange={setLastTestDate} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.nextTestDue")}</label>
          <DateField value={nextTestDue} onChange={setNextTestDue} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ElectricalInstallationStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`plantIntegrity.electrical.statuses.${s}`)}</option>)}
          </select>
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

function TestForm({ item, onSubmit, onCancel }: {
  item: ElectricalInstallation;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [testType, setTestType] = useState<ElectricalTestType>("EARTH_LEAKAGE");
  const [testedByName, setTestedByName] = useState("");
  const [result, setResult] = useState<ElectricalTestResult>("PASS");
  const [measuredValue, setMeasuredValue] = useState("");
  const [unit, setUnit] = useState("");
  const [findings, setFindings] = useState("");
  const [nextTestDue, setNextTestDue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const isExInspection = testType === "EX_INSPECTION";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        testDate,
        testType,
        testedByName,
        result,
        measuredValue: measuredValue ? Number(measuredValue) : null,
        unit: unit || undefined,
        findings: findings || undefined,
        nextTestDue: nextTestDue || null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("plantIntegrity.electrical.testHint", { identifier: item.identifier })}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.testDate")}</label>
          <DateField value={testDate} onChange={setTestDate} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.testType")}</label>
          <select className={selectClass} value={testType} onChange={(e) => setTestType(e.target.value as ElectricalTestType)}>
            {testTypes.map((v) => <option key={v} value={v}>{t(`plantIntegrity.electrical.testTypes.${v}`)}</option>)}
          </select>
        </div>
      </div>
      {isExInspection && <p className="text-xs text-mine-400">{t("plantIntegrity.electrical.exInspectionHint")}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.testedByName")}</label>
          <input className={inputClass} value={testedByName} onChange={(e) => setTestedByName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.result")}</label>
          <select className={selectClass} value={result} onChange={(e) => setResult(e.target.value as ElectricalTestResult)}>
            {testResults.map((v) => <option key={v} value={v}>{t(`plantIntegrity.electrical.testResults.${v}`)}</option>)}
          </select>
        </div>
      </div>
      {result === "FAIL" && <p className="text-xs text-hazard-500">{t("plantIntegrity.electrical.failWarning")}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.measuredValue")}</label>
          <input className={inputClass} type="number" step="any" value={measuredValue} onChange={(e) => setMeasuredValue(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.electrical.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mA / MΩ / Ω / °C" />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("plantIntegrity.findings")}</label>
        <textarea className={inputClass} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{isExInspection ? t("plantIntegrity.electrical.exCertificateExpiry") : t("plantIntegrity.electrical.nextTestDue")}</label>
        <DateField value={nextTestDue} onChange={setNextTestDue} />
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

export default function ElectricalComplianceTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<ElectricalInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | ElectricalInstallation>(null);
  const [testModal, setTestModal] = useState<ElectricalInstallation | null>(null);
  const [historyFor, setHistoryFor] = useState<ElectricalInstallation | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ElectricalInstallation[]>("/electrical-compliance/installations");
      setItems(res.data);
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
    const live = items.filter((i) => i.status === "IN_SERVICE");
    const hazardous = live.filter((i) => i.hazardousArea);
    // The single most dangerous state this register can surface: energised
    // apparatus in a classified area with no explosion-protection technique.
    const unprotected = hazardous.filter((i) => i.exProtection === "NONE").length;
    const exExpired = hazardous.filter((i) => i.exProtection !== "NONE" && (isOverdue(i.exCertificateExpiry) || !i.exCertificateExpiry)).length;
    const testOverdue = live.filter((i) => isOverdue(i.nextTestDue) || !i.nextTestDue).length;
    const noElp = live.filter((i) => !i.earthLeakageProtected).length;
    return { live: live.length, hazardous: hazardous.length, unprotected, exExpired, testOverdue, noElp };
  }, [items]);

  async function create(data: any) {
    await api.post("/electrical-compliance/installations", data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/electrical-compliance/installations/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("plantIntegrity.electrical.confirmDelete"))) return;
    await api.delete(`/electrical-compliance/installations/${id}`);
    await load();
  }
  async function logTest(id: string, data: any) {
    await api.post(`/electrical-compliance/installations/${id}/tests`, data);
    setTestModal(null);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<ElectricalInstallation>[] = [
    { key: "identifier", header: t("plantIntegrity.electrical.identifier"), render: (i) => i.identifier, sortValue: (i) => i.identifier },
    { key: "installationType", header: t("common.type"), render: (i) => t(`plantIntegrity.electrical.types.${i.installationType}`), sortValue: (i) => i.installationType },
    { key: "site", header: t("common.site"), render: (i) => `${i.site?.name ?? "—"}${i.zone ? ` · ${i.zone.name}` : ""}`, sortValue: (i) => i.site?.name ?? "" },
    { key: "voltageRating", header: t("plantIntegrity.electrical.voltageShort"), render: (i) => i.voltageRating || "—", sortValue: (i) => i.voltageRating ?? "" },
    {
      key: "exProtection",
      header: t("plantIntegrity.electrical.exShort"),
      render: (i) =>
        i.hazardousArea && i.exProtection === "NONE" ? (
          <span className="text-danger-500 font-semibold">{t("plantIntegrity.electrical.unprotected")}</span>
        ) : (
          <span className={i.hazardousArea ? "text-mine-100" : "text-mine-400"}>{t(`plantIntegrity.electrical.exTypes.${i.exProtection}`)}</span>
        ),
      sortValue: (i) => i.exProtection,
    },
    {
      key: "exCertificateExpiry",
      header: t("plantIntegrity.electrical.exExpiryShort"),
      render: (i) => (i.hazardousArea && i.exProtection !== "NONE" ? <DueDate value={i.exCertificateExpiry} /> : "—"),
      sortValue: (i) => i.exCertificateExpiry ?? "9999",
    },
    {
      key: "earthLeakageProtected",
      header: t("plantIntegrity.electrical.elpShort"),
      render: (i) => (i.earthLeakageProtected ? <span className="text-success-500">{t("common.yes")}</span> : <span className="text-hazard-500">{t("common.no")}</span>),
      sortValue: (i) => (i.earthLeakageProtected ? 1 : 0),
    },
    { key: "nextTestDue", header: t("plantIntegrity.electrical.nextTestDue"), render: (i) => <DueDate value={i.nextTestDue} />, sortValue: (i) => i.nextTestDue ?? "9999" },
    { key: "status", header: t("common.status"), render: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("plantIntegrity.electrical.statUnprotected")}
          value={stats.unprotected}
          target={t("plantIntegrity.targetZero")}
          tone={stats.unprotected === 0 ? "good" : "bad"}
          hint={t("plantIntegrity.electrical.statUnprotectedHint", { count: stats.hazardous })}
        />
        <StatTile
          label={t("plantIntegrity.electrical.statExExpired")}
          value={stats.exExpired}
          target={t("plantIntegrity.targetZero")}
          tone={stats.exExpired === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("plantIntegrity.electrical.statTestOverdue")}
          value={stats.testOverdue}
          target={t("plantIntegrity.targetZero")}
          tone={stats.testOverdue === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("plantIntegrity.electrical.statNoElp")}
          value={stats.noElp}
          target={t("plantIntegrity.targetZero")}
          tone={stats.noElp === 0 ? "good" : "warn"}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("plantIntegrity.electrical.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("plantIntegrity.electrical.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("plantIntegrity.electrical.newItem")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(i) => i.id}
          emptyMessage={t("plantIntegrity.electrical.noneYet")}
          searchValue={(i) => `${i.identifier} ${i.description ?? ""} ${i.location ?? ""} ${i.cocNumber ?? ""} ${i.exCertificateNumber ?? ""}`}
          exportFilename="electrical-installations"
          exportColumns={[
            { header: t("plantIntegrity.electrical.identifier"), value: (i) => i.identifier },
            { header: t("common.type"), value: (i) => i.installationType },
            { header: t("common.site"), value: (i) => i.site?.name ?? "" },
            { header: t("common.zone"), value: (i) => i.zone?.name ?? "" },
            { header: t("plantIntegrity.electrical.hazardousArea"), value: (i) => (i.hazardousArea ? "YES" : "NO") },
            { header: t("plantIntegrity.electrical.exProtection"), value: (i) => i.exProtection },
            { header: t("plantIntegrity.electrical.exCertificateExpiry"), value: (i) => i.exCertificateExpiry?.slice(0, 10) ?? "" },
            { header: t("plantIntegrity.electrical.earthLeakageProtected"), value: (i) => (i.earthLeakageProtected ? "YES" : "NO") },
            { header: t("plantIntegrity.electrical.nextTestDue"), value: (i) => i.nextTestDue?.slice(0, 10) ?? "" },
            { header: t("common.status"), value: (i) => i.status },
          ]}
          actions={(i) => (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryFor(i)}>{t("plantIntegrity.history")}</button>
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setTestModal(i)}>{t("plantIntegrity.electrical.logTest")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(i)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(i.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("plantIntegrity.electrical.newItemTitle") : t("plantIntegrity.electrical.editItemTitle")} onClose={() => setFormModal(null)}>
          <InstallationForm
            sites={sites}
            zones={zones}
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(data) => (formModal === "create" ? create(data) : update(formModal.id, data))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}

      {testModal && (
        <Modal title={t("plantIntegrity.electrical.logTest")} onClose={() => setTestModal(null)}>
          <TestForm item={testModal} onSubmit={(data) => logTest(testModal.id, data)} onCancel={() => setTestModal(null)} />
        </Modal>
      )}

      {historyFor && (
        <Modal title={t("plantIntegrity.historyTitle", { identifier: historyFor.identifier })} onClose={() => setHistoryFor(null)}>
          {historyFor.tests && historyFor.tests.length > 0 ? (
            <ul className="space-y-3">
              {historyFor.tests.map((test) => (
                <li key={test.id} className="border-b border-mine-800 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-mine-100">{t(`plantIntegrity.electrical.testTypes.${test.testType}`)}</span>
                    <StatusBadge status={test.result} />
                  </div>
                  <p className="text-xs text-mine-400">
                    {new Date(test.testDate).toLocaleDateString()} · {test.testedByName}
                    {test.measuredValue != null ? ` · ${test.measuredValue}${test.unit ? ` ${test.unit}` : ""}` : ""}
                  </p>
                  {test.findings && <p className="text-xs text-hazard-500 mt-1">{test.findings}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mine-400">{t("plantIntegrity.noHistory")}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
