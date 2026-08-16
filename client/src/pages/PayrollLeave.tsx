import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BceaComplianceReport, LeaveBalance, LeaveRequest, LeaveType, Payslip, Worker } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import FileDropzone from "../components/FileDropzone";
import LoadError from "../components/LoadError";

const leaveTypes: LeaveType[] = ["ANNUAL", "SICK", "FAMILY_RESPONSIBILITY", "UNPAID", "STUDY", "MATERNITY_PATERNITY", "OTHER"];

function LeaveForm({ workers, onSubmit, onCancel }: {
  workers: Worker[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [leaveType, setLeaveType] = useState<LeaveType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysRequested, setDaysRequested] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ workerId, leaveType, startDate, endDate, daysRequested: Number(daysRequested), reason: reason || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("workers.title")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("payroll.leaveType")}</label>
          <select className={selectClass} value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>
            {leaveTypes.map((lt) => <option key={lt} value={lt}>{t(`payroll.leaveTypes.${lt}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("payroll.startDate")}</label>
          <DateField value={startDate} onChange={setStartDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("payroll.endDate")}</label>
          <DateField value={endDate} onChange={setEndDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("payroll.daysRequested")}</label>
          <input className={inputClass} type="number" step="any" value={daysRequested} onChange={(e) => setDaysRequested(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("payroll.reason")}</label>
        <textarea className={inputClass} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function PayslipForm({ workers, onSubmit, onCancel }: {
  workers: Worker[];
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [grossPay, setGrossPay] = useState("");
  const [deductions, setDeductions] = useState("");
  const [netPay, setNetPay] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("workerId", workerId);
      form.append("payPeriodStart", payPeriodStart);
      form.append("payPeriodEnd", payPeriodEnd);
      form.append("grossPay", grossPay);
      form.append("deductions", deductions);
      form.append("netPay", netPay);
      if (file) form.append("file", file);
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("workers.title")}</label>
        <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("payroll.payPeriodStart")}</label>
          <DateField value={payPeriodStart} onChange={setPayPeriodStart} required />
        </div>
        <div>
          <label className={labelClass}>{t("payroll.payPeriodEnd")}</label>
          <DateField value={payPeriodEnd} onChange={setPayPeriodEnd} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("payroll.grossPay")}</label>
          <input className={inputClass} type="number" step="any" value={grossPay} onChange={(e) => setGrossPay(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("payroll.deductions")}</label>
          <input className={inputClass} type="number" step="any" value={deductions} onChange={(e) => setDeductions(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("payroll.netPay")}</label>
          <input className={inputClass} type="number" step="any" value={netPay} onChange={(e) => setNetPay(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("payroll.payslipFile")}</label>
        <FileDropzone accept="image/*,.pdf" onFiles={(files) => setFile(files.item(0))} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function LeaveTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<LeaveRequest[]>("/payroll/leave");
      setRequests(res.data);
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
    await api.post("/payroll/leave", data);
    setModal(false);
    await load();
  }

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    await api.post(`/payroll/leave/${id}/review`, { decision });
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("payroll.confirmDeleteLeave"))) return;
    await api.delete(`/payroll/leave/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("payroll.newLeaveRequest")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workers.title")}</th>
              <th className="text-left px-4 py-2">{t("payroll.leaveType")}</th>
              <th className="text-left px-4 py-2">{t("payroll.startDate")}</th>
              <th className="text-left px-4 py-2">{t("payroll.endDate")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{r.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`payroll.leaveTypes.${r.leaveType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(r.startDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(r.endDate).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {canEdit && r.status === "PENDING" && (
                      <>
                        <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => review(r.id, "APPROVED")}>{t("common.approve")}</button>
                        <button className={buttonSecondary} onClick={() => review(r.id, "REJECTED")}>{t("common.reject")}</button>
                      </>
                    )}
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("payroll.noneYetLeave")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("payroll.newLeaveRequestTitle")} onClose={() => setModal(false)}>
          <LeaveForm workers={workers} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function PayslipsTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<Payslip[]>("/payroll/payslips");
      setPayslips(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: FormData) {
    await api.post("/payroll/payslips", data, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("payroll.confirmDeletePayslip"))) return;
    await api.delete(`/payroll/payslips/${id}`);
    await load();
  }

  async function download(p: Payslip) {
    const res = await api.get(`/payroll/payslips/${p.id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = p.fileName ?? "payslip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("payroll.newPayslip")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workers.title")}</th>
              <th className="text-left px-4 py-2">{t("payroll.payPeriod")}</th>
              <th className="text-left px-4 py-2">{t("payroll.grossPay")}</th>
              <th className="text-left px-4 py-2">{t("payroll.netPay")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((p) => (
              <tr key={p.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{p.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">
                  {new Date(p.payPeriodStart).toLocaleDateString()} – {new Date(p.payPeriodEnd).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-mine-300">{p.grossPay.toLocaleString()}</td>
                <td className="px-4 py-2 text-mine-300">{p.netPay.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {p.fileName && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => download(p)}>{t("documents.download")}</button>
                    )}
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(p.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {payslips.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("payroll.noneYetPayslips")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("payroll.newPayslipTitle")} onClose={() => setModal(false)}>
          <PayslipForm workers={workers} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function LeaveBalanceForm({ workers, onSubmit, onCancel }: { workers: Worker[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [leaveType, setLeaveType] = useState<LeaveType>("ANNUAL");
  const [cycleStartDate, setCycleStartDate] = useState("");
  const [cycleEndDate, setCycleEndDate] = useState("");
  const [entitlementDays, setEntitlementDays] = useState("15");
  const [carriedOverDays, setCarriedOverDays] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId,
        leaveType,
        cycleStartDate,
        cycleEndDate,
        entitlementDays: Number(entitlementDays),
        carriedOverDays: Number(carriedOverDays),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("workers.title")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("payroll.leaveType")}</label>
          <select className={selectClass} value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>
            {leaveTypes.map((lt) => <option key={lt} value={lt}>{t(`payroll.leaveTypes.${lt}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("payroll.leaveBalances.cycleStartDate")}</label>
          <DateField value={cycleStartDate} onChange={setCycleStartDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("payroll.leaveBalances.cycleEndDate")}</label>
          <DateField value={cycleEndDate} onChange={setCycleEndDate} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("payroll.leaveBalances.entitlementDays")}</label>
          <input className={inputClass} type="number" step="any" value={entitlementDays} onChange={(e) => setEntitlementDays(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("payroll.leaveBalances.carriedOverDays")}</label>
          <input className={inputClass} type="number" step="any" value={carriedOverDays} onChange={(e) => setCarriedOverDays(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function LeaveBalancesTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<LeaveBalance[]>("/payroll/leave-balances");
      setBalances(res.data);
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
    await api.post("/payroll/leave-balances", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/payroll/leave-balances/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("payroll.leaveBalances.hint")}</p>
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("payroll.leaveBalances.new")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workers.title")}</th>
              <th className="text-left px-4 py-2">{t("payroll.leaveType")}</th>
              <th className="text-left px-4 py-2">{t("payroll.leaveBalances.entitlementDays")}</th>
              <th className="text-left px-4 py-2">{t("payroll.leaveBalances.takenDays")}</th>
              <th className="text-left px-4 py-2">{t("payroll.leaveBalances.remainingDays")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{b.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`payroll.leaveTypes.${b.leaveType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{(b.entitlementDays + b.carriedOverDays).toFixed(1)}</td>
                <td className="px-4 py-2 text-mine-300">{b.takenDays.toFixed(1)}</td>
                <td className={`px-4 py-2 font-medium ${b.remainingDays < 0 ? "text-danger-500" : ""}`}>{b.remainingDays.toFixed(1)}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(b.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {balances.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("payroll.leaveBalances.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("payroll.leaveBalances.newTitle")} onClose={() => setModal(false)}>
          <LeaveBalanceForm workers={workers} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function BceaComplianceTab() {
  const { t } = useTranslation();
  const [report, setReport] = useState<BceaComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [days, setDays] = useState(7);

  async function load(d: number) {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<BceaComplianceReport>("/payroll/bcea-compliance", { params: { days: d } });
      setReport(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("payroll.bceaCompliance.hint")}</p>
      <div className="flex items-center gap-3">
        <label className={labelClass}>{t("payroll.bceaCompliance.periodDays")}</label>
        <select
          className={`${selectClass} w-auto`}
          value={days}
          onChange={(e) => { const d = Number(e.target.value); setDays(d); load(d); }}
        >
          <option value={7}>7</option>
          <option value={14}>14</option>
          <option value={31}>31</option>
        </select>
      </div>
      {loading && <div className="text-mine-300">{t("common.loading")}</div>}
      {loadError && <LoadError onRetry={() => load(days)} />}
      {!loading && report && (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("workers.title")}</th>
                <th className="text-left px-4 py-2">{t("payroll.bceaCompliance.breachType")}</th>
                <th className="text-left px-4 py-2">{t("common.description")}</th>
              </tr>
            </thead>
            <tbody>
              {report.breaches.map((b, idx) => (
                <tr key={`${b.workerId}-${idx}`} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{b.workerName}</td>
                  <td className="px-4 py-2 text-danger-500">{t(`payroll.bceaCompliance.breachTypes.${b.type}`)}</td>
                  <td className="px-4 py-2 text-mine-300">{b.detail}</td>
                </tr>
              ))}
              {report.breaches.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-mine-400">{t("payroll.bceaCompliance.noBreaches")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PayrollLeave() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"leave" | "payslips" | "balances" | "bcea">("leave");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    api
      .get<Worker[]>("/workers")
      .then((res) => setWorkers(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("payroll.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("payroll.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={tab === "leave" ? buttonPrimary : buttonSecondary} onClick={() => setTab("leave")}>
          {t("payroll.tabLeave")}
        </button>
        <button className={tab === "payslips" ? buttonPrimary : buttonSecondary} onClick={() => setTab("payslips")}>
          {t("payroll.tabPayslips")}
        </button>
        <button className={tab === "balances" ? buttonPrimary : buttonSecondary} onClick={() => setTab("balances")}>
          {t("payroll.tabLeaveBalances")}
        </button>
        <button className={tab === "bcea" ? buttonPrimary : buttonSecondary} onClick={() => setTab("bcea")}>
          {t("payroll.tabBceaCompliance")}
        </button>
      </div>

      {tab === "leave" && <LeaveTab workers={workers} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "payslips" && <PayslipsTab workers={workers} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "balances" && <LeaveBalancesTab workers={workers} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "bcea" && <BceaComplianceTab />}
    </div>
  );
}
