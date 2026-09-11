import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { DustFalloutReading, EmissionLicence, EmissionLicenceStatus, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import DueDate, { isOverdue } from "./DueDate";
import StatTile from "../plant/StatTile";

const licenceStatuses: EmissionLicenceStatus[] = ["ACTIVE", "EXPIRED", "SUSPENDED", "UNDER_REVIEW"];

function LicenceForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: EmissionLicence;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [licenceNumber, setLicenceNumber] = useState(initial?.licenceNumber ?? "");
  const [issuingAuthority, setIssuingAuthority] = useState(initial?.issuingAuthority ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate?.slice(0, 10) ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<EmissionLicenceStatus>(initial?.status ?? "ACTIVE");
  const [conditionsSummary, setConditionsSummary] = useState(initial?.conditionsSummary ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        licenceNumber,
        issuingAuthority: issuingAuthority || undefined,
        issueDate: issueDate || null,
        expiryDate: expiryDate || null,
        status,
        conditionsSummary: conditionsSummary || undefined,
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
          <label className={labelClass}>{t("environmentalRegisters.emissions.licenceNumber")}</label>
          <input className={inputClass} value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("environmentalRegisters.emissions.issuingAuthority")}</label>
        <input className={inputClass} value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.issueDate")}</label>
          <DateField value={issueDate} onChange={setIssueDate} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.expiryDate")}</label>
          <DateField value={expiryDate} onChange={setExpiryDate} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as EmissionLicenceStatus)}>
            {licenceStatuses.map((s) => <option key={s} value={s}>{t(`environmentalRegisters.emissions.licenceStatuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("environmentalRegisters.emissions.conditionsSummary")}</label>
        <textarea className={inputClass} rows={2} value={conditionsSummary} onChange={(e) => setConditionsSummary(e.target.value)} />
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

function StackTestForm({ licence, onSubmit, onCancel }: {
  licence: EmissionLicence;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [stackName, setStackName] = useState("");
  const [pollutant, setPollutant] = useState("");
  const [measuredValue, setMeasuredValue] = useState("");
  const [unit, setUnit] = useState("mg/Nm³");
  const [licensedLimit, setLicensedLimit] = useState("");
  const [testingAuthority, setTestingAuthority] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [nextTestDue, setNextTestDue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        testDate,
        stackName,
        pollutant,
        measuredValue: Number(measuredValue),
        unit,
        licensedLimit: licensedLimit ? Number(licensedLimit) : null,
        testingAuthority: testingAuthority || undefined,
        certificateNumber: certificateNumber || undefined,
        nextTestDue: nextTestDue || null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("environmentalRegisters.emissions.stackTestHint", { number: licence.licenceNumber })}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.testDate")}</label>
          <DateField value={testDate} onChange={setTestDate} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.stackName")}</label>
          <input className={inputClass} value={stackName} onChange={(e) => setStackName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.pollutant")}</label>
          <input className={inputClass} value={pollutant} onChange={(e) => setPollutant(e.target.value)} required placeholder="PM / SO₂ / NOx" />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.measuredValue")}</label>
          <input className={inputClass} type="number" step="any" value={measuredValue} onChange={(e) => setMeasuredValue(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("environmentalRegisters.emissions.licensedLimit")}</label>
        <input className={inputClass} type="number" step="any" value={licensedLimit} onChange={(e) => setLicensedLimit(e.target.value)} />
        <p className="text-[11px] text-mine-400 mt-1">{t("environmentalRegisters.emissions.licensedLimitHint")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.testingAuthority")}</label>
          <input className={inputClass} value={testingAuthority} onChange={(e) => setTestingAuthority(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.certificateNumber")}</label>
          <input className={inputClass} value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("environmentalRegisters.emissions.nextTestDue")}</label>
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

function DustReadingForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [monitoringPoint, setMonitoringPoint] = useState("");
  const [readingMonth, setReadingMonth] = useState(new Date().toISOString().slice(0, 10));
  const [dustFalloutRate, setDustFalloutRate] = useState("");
  const [thresholdMgM2Day, setThresholdMgM2Day] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        monitoringPoint,
        readingMonth,
        dustFalloutRate: Number(dustFalloutRate),
        thresholdMgM2Day: thresholdMgM2Day ? Number(thresholdMgM2Day) : null,
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
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.monitoringPoint")}</label>
          <input className={inputClass} value={monitoringPoint} onChange={(e) => setMonitoringPoint(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.readingMonth")}</label>
          <DateField value={readingMonth} onChange={setReadingMonth} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.dustFalloutRate")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={dustFalloutRate} onChange={(e) => setDustFalloutRate(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.emissions.thresholdMgM2Day")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={thresholdMgM2Day} onChange={(e) => setThresholdMgM2Day(e.target.value)} />
        </div>
      </div>
      <p className="text-[11px] text-mine-400">{t("environmentalRegisters.emissions.dustHint")}</p>
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

export default function EmissionComplianceTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [licences, setLicences] = useState<EmissionLicence[]>([]);
  const [dustReadings, setDustReadings] = useState<DustFalloutReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [licenceModal, setLicenceModal] = useState<null | "create" | EmissionLicence>(null);
  const [testModal, setTestModal] = useState<EmissionLicence | null>(null);
  const [historyFor, setHistoryFor] = useState<EmissionLicence | null>(null);
  const [dustModal, setDustModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [l, d] = await Promise.all([
        api.get<EmissionLicence[]>("/emission-compliance/licences"),
        api.get<DustFalloutReading[]>("/emission-compliance/dust-fallout"),
      ]);
      setLicences(l.data);
      setDustReadings(d.data);
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
    const active = licences.filter((l) => l.status === "ACTIVE");
    const expiring = active.filter((l) => isOverdue(l.expiryDate) || !l.expiryDate);
    const recentDust = dustReadings.slice(0, 30);
    const dustExceedances = recentDust.filter((r) => !r.withinLimit).length;
    const nonCompliantTests = licences.flatMap((l) => l.stackTests ?? []).filter((t) => !t.compliant).length;
    return { active: active.length, expiring: expiring.length, dustExceedances, dustReadingsCount: recentDust.length, nonCompliantTests };
  }, [licences, dustReadings]);

  async function createLicence(data: any) {
    await api.post("/emission-compliance/licences", data);
    setLicenceModal(null);
    await load();
  }
  async function updateLicence(id: string, data: any) {
    await api.put(`/emission-compliance/licences/${id}`, data);
    setLicenceModal(null);
    await load();
  }
  async function removeLicence(id: string) {
    if (!confirm(t("environmentalRegisters.emissions.confirmDeleteLicence"))) return;
    await api.delete(`/emission-compliance/licences/${id}`);
    await load();
  }
  async function addStackTest(id: string, data: any) {
    await api.post(`/emission-compliance/licences/${id}/stack-tests`, data);
    setTestModal(null);
    await load();
  }
  async function addDustReading(data: any) {
    await api.post("/emission-compliance/dust-fallout", data);
    setDustModal(false);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<EmissionLicence>[] = [
    { key: "licenceNumber", header: t("environmentalRegisters.emissions.licenceNumber"), render: (l) => l.licenceNumber, sortValue: (l) => l.licenceNumber },
    { key: "site", header: t("common.site"), render: (l) => l.site?.name ?? "—", sortValue: (l) => l.site?.name ?? "" },
    { key: "issuingAuthority", header: t("environmentalRegisters.emissions.issuingAuthority"), render: (l) => l.issuingAuthority || "—", sortValue: (l) => l.issuingAuthority ?? "" },
    { key: "expiryDate", header: t("environmentalRegisters.emissions.expiryDate"), render: (l) => <DueDate value={l.expiryDate} />, sortValue: (l) => l.expiryDate ?? "9999" },
    {
      key: "lastTest",
      header: t("environmentalRegisters.emissions.lastStackTest"),
      render: (l) => {
        const last = l.stackTests?.[0];
        if (!last) return <span className="text-hazard-500">{t("environmentalRegisters.emissions.noTestsYet")}</span>;
        return (
          <span className={last.compliant ? "text-mine-200" : "text-danger-500 font-semibold"}>
            {new Date(last.testDate).toLocaleDateString()}
          </span>
        );
      },
      sortValue: (l) => l.stackTests?.[0]?.testDate ?? "",
    },
    { key: "status", header: t("common.status"), render: (l) => <StatusBadge status={l.status} />, sortValue: (l) => l.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("environmentalRegisters.emissions.statExpiring")}
          value={stats.expiring}
          target={t("environmentalRegisters.targetZero")}
          tone={stats.expiring === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("environmentalRegisters.emissions.statNonCompliantTests")}
          value={stats.nonCompliantTests}
          target={t("environmentalRegisters.targetZero")}
          tone={stats.nonCompliantTests === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("environmentalRegisters.emissions.statDustExceedances")}
          value={stats.dustExceedances}
          target={t("environmentalRegisters.emissions.statDustExceedancesTarget", { count: stats.dustReadingsCount })}
          tone={stats.dustExceedances === 0 ? "good" : "bad"}
        />
        <StatTile label={t("environmentalRegisters.emissions.statActiveLicences")} value={stats.active} target={t("environmentalRegisters.emissions.statActiveLicencesTarget")} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("environmentalRegisters.emissions.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("environmentalRegisters.emissions.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setLicenceModal("create")} disabled={sites.length === 0}>{t("environmentalRegisters.emissions.newLicence")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={licences}
          rowKey={(l) => l.id}
          emptyMessage={t("environmentalRegisters.emissions.noneYet")}
          searchValue={(l) => `${l.licenceNumber} ${l.issuingAuthority ?? ""}`}
          exportFilename="emission-licences"
          exportColumns={[
            { header: t("environmentalRegisters.emissions.licenceNumber"), value: (l) => l.licenceNumber },
            { header: t("common.site"), value: (l) => l.site?.name ?? "" },
            { header: t("environmentalRegisters.emissions.expiryDate"), value: (l) => l.expiryDate?.slice(0, 10) ?? "" },
            { header: t("common.status"), value: (l) => l.status },
          ]}
          actions={(l) => (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryFor(l)}>{t("environmentalRegisters.emissions.stackTests")}</button>
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setTestModal(l)}>{t("environmentalRegisters.emissions.logStackTest")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setLicenceModal(l)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removeLicence(l.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("environmentalRegisters.emissions.dustTitle")}</h2>
            <p className="text-xs text-mine-400">{t("environmentalRegisters.emissions.dustHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setDustModal(true)} disabled={sites.length === 0}>{t("environmentalRegisters.emissions.newDustReading")}</button>}
        </div>
        <DataTable
          columns={[
            { key: "monitoringPoint", header: t("environmentalRegisters.emissions.monitoringPoint"), render: (r: DustFalloutReading) => r.monitoringPoint, sortValue: (r: DustFalloutReading) => r.monitoringPoint },
            { key: "site", header: t("common.site"), render: (r: DustFalloutReading) => r.site?.name ?? "—", sortValue: (r: DustFalloutReading) => r.site?.name ?? "" },
            { key: "readingMonth", header: t("environmentalRegisters.emissions.readingMonth"), render: (r: DustFalloutReading) => new Date(r.readingMonth).toLocaleDateString(undefined, { month: "short", year: "numeric" }), sortValue: (r: DustFalloutReading) => r.readingMonth },
            { key: "dustFalloutRate", header: t("environmentalRegisters.emissions.dustFalloutRate"), render: (r: DustFalloutReading) => `${r.dustFalloutRate.toLocaleString()} mg/m²/day`, sortValue: (r: DustFalloutReading) => r.dustFalloutRate },
            { key: "withinLimit", header: t("common.status"), render: (r: DustFalloutReading) => <StatusBadge status={r.withinLimit ? "PASS" : "FAIL"} />, sortValue: (r: DustFalloutReading) => (r.withinLimit ? 1 : 0) },
          ]}
          rows={dustReadings}
          rowKey={(r) => r.id}
          emptyMessage={t("environmentalRegisters.emissions.noDustReadingsYet")}
          searchValue={(r) => r.monitoringPoint}
          exportFilename="dust-fallout-readings"
          exportColumns={[
            { header: t("environmentalRegisters.emissions.monitoringPoint"), value: (r) => r.monitoringPoint },
            { header: t("environmentalRegisters.emissions.readingMonth"), value: (r) => r.readingMonth.slice(0, 10) },
            { header: t("environmentalRegisters.emissions.dustFalloutRate"), value: (r) => String(r.dustFalloutRate) },
          ]}
          actions={(r) => (canDelete ? <button className={buttonDanger} onClick={async () => { if (confirm(t("environmentalRegisters.emissions.confirmDeleteDust"))) { await api.delete(`/emission-compliance/dust-fallout/${r.id}`); await load(); } }}>{t("common.delete")}</button> : null)}
        />
      </div>

      {licenceModal && (
        <Modal title={licenceModal === "create" ? t("environmentalRegisters.emissions.newLicenceTitle") : t("environmentalRegisters.emissions.editLicenceTitle")} onClose={() => setLicenceModal(null)}>
          <LicenceForm
            sites={sites}
            initial={licenceModal === "create" ? undefined : licenceModal}
            onSubmit={(data) => (licenceModal === "create" ? createLicence(data) : updateLicence(licenceModal.id, data))}
            onCancel={() => setLicenceModal(null)}
          />
        </Modal>
      )}

      {testModal && (
        <Modal title={t("environmentalRegisters.emissions.logStackTest")} onClose={() => setTestModal(null)}>
          <StackTestForm licence={testModal} onSubmit={(data) => addStackTest(testModal.id, data)} onCancel={() => setTestModal(null)} />
        </Modal>
      )}

      {dustModal && (
        <Modal title={t("environmentalRegisters.emissions.newDustReading")} onClose={() => setDustModal(false)}>
          <DustReadingForm sites={sites} onSubmit={addDustReading} onCancel={() => setDustModal(false)} />
        </Modal>
      )}

      {historyFor && (
        <Modal title={t("environmentalRegisters.emissions.stackTestsTitle", { number: historyFor.licenceNumber })} onClose={() => setHistoryFor(null)}>
          {historyFor.stackTests && historyFor.stackTests.length > 0 ? (
            <ul className="space-y-3">
              {historyFor.stackTests.map((test) => (
                <li key={test.id} className="border-b border-mine-800 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-mine-100">{test.stackName} · {test.pollutant}</span>
                    <StatusBadge status={test.compliant ? "PASS" : "FAIL"} />
                  </div>
                  <p className="text-xs text-mine-400">
                    {new Date(test.testDate).toLocaleDateString()} · {test.measuredValue} {test.unit}
                    {test.licensedLimit != null ? ` (${t("environmentalRegisters.emissions.limitLabel", { limit: test.licensedLimit })})` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mine-400">{t("environmentalRegisters.emissions.noTestsYet")}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
