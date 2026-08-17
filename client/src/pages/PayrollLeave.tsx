import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BceaBreach, BceaComplianceReport, LeaveBalance, LeaveRequest, LeaveType, Payee, Payslip, Worker } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import FileDropzone from "../components/FileDropzone";
import DataTable, { DataTableColumn } from "../components/DataTable";
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

function PayslipForm({ workers, companyPayees, onSubmit, onCancel }: {
  workers: Worker[];
  companyPayees: Payee[];
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [payeeMode, setPayeeMode] = useState<"EMPLOYEE" | "COMPANY">("EMPLOYEE");
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [payeeId, setPayeeId] = useState(companyPayees[0]?.id ?? "");
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [grossPay, setGrossPay] = useState("");
  const [deductions, setDeductions] = useState("");
  const [netPay, setNetPay] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      if (payeeMode === "EMPLOYEE") {
        form.append("workerId", workerId);
        form.append("grossPay", grossPay);
        form.append("deductions", deductions);
        form.append("netPay", netPay);
      } else {
        form.append("payeeId", payeeId);
        form.append("grossPay", amount);
        form.append("deductions", "0");
        form.append("netPay", amount);
      }
      form.append("payPeriodStart", payPeriodStart);
      form.append("payPeriodEnd", payPeriodEnd);
      if (file) form.append("file", file);
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("payroll.payeeMode")}</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={payeeMode === "EMPLOYEE" ? buttonPrimary : buttonSecondary}
            onClick={() => setPayeeMode("EMPLOYEE")}
          >
            {t("payroll.payeeModeEmployee")}
          </button>
          <button
            type="button"
            className={payeeMode === "COMPANY" ? buttonPrimary : buttonSecondary}
            onClick={() => setPayeeMode("COMPANY")}
          >
            {t("payroll.payeeModeCompany")}
          </button>
        </div>
      </div>
      {payeeMode === "EMPLOYEE" ? (
        <div>
          <label className={labelClass}>{t("workers.title")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label className={labelClass}>{t("payroll.companyPayee")}</label>
          {companyPayees.length === 0 ? (
            <p className="text-xs text-mine-400">{t("payroll.noCompanyPayees")}</p>
          ) : (
            <select className={selectClass} value={payeeId} onChange={(e) => setPayeeId(e.target.value)}>
              {companyPayees.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      )}
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
      {payeeMode === "EMPLOYEE" ? (
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
      ) : (
        <div>
          <label className={labelClass}>{t("payroll.amount")}</label>
          <input className={inputClass} type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
      )}
      <div>
        <label className={labelClass}>{t("payroll.payslipFile")}</label>
        <FileDropzone accept="image/*,.pdf" onFiles={(files) => setFile(files.item(0))} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button
          type="submit"
          className={buttonPrimary}
          disabled={saving || (payeeMode === "COMPANY" && companyPayees.length === 0)}
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
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

  const columns: DataTableColumn<LeaveRequest>[] = [
    { key: "worker", header: t("workers.title"), render: (r) => <span className="font-medium">{r.worker?.name}</span>, sortValue: (r) => r.worker?.name ?? "" },
    { key: "type", header: t("payroll.leaveType"), render: (r) => t(`payroll.leaveTypes.${r.leaveType}`), sortValue: (r) => r.leaveType },
    { key: "start", header: t("payroll.startDate"), render: (r) => new Date(r.startDate).toLocaleDateString(), sortValue: (r) => r.startDate },
    { key: "end", header: t("payroll.endDate"), render: (r) => new Date(r.endDate).toLocaleDateString(), sortValue: (r) => r.endDate },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} />, sortValue: (r) => r.status },
  ];

  return (
    <div className="space-y-4">
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("payroll.newLeaveRequest")}</button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={requests}
        rowKey={(r) => r.id}
        emptyMessage={t("payroll.noneYetLeave")}
        searchValue={(r) => `${r.worker?.name ?? ""} ${r.leaveType}`}
        exportFilename="leave-requests"
        exportColumns={[
          { header: t("workers.title"), value: (r) => r.worker?.name ?? "" },
          { header: t("payroll.leaveType"), value: (r) => r.leaveType },
          { header: t("payroll.startDate"), value: (r) => r.startDate },
          { header: t("payroll.endDate"), value: (r) => r.endDate },
          { header: t("common.status"), value: (r) => r.status },
        ]}
        actions={(r) => (
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
        )}
      />
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
  const [companyPayees, setCompanyPayees] = useState<Payee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [payslipsRes, payeesRes] = await Promise.all([
        api.get<Payslip[]>("/payroll/payslips"),
        api.get<Payee[]>("/payees"),
      ]);
      setPayslips(payslipsRes.data);
      setCompanyPayees(payeesRes.data.filter((p) => p.payeeType === "COMPANY"));
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

  const payeeName = (p: Payslip) => p.worker?.name ?? p.payee?.name ?? "";

  const columns: DataTableColumn<Payslip>[] = [
    {
      key: "payee",
      header: t("payroll.payee"),
      render: (p) => (
        <span className="font-medium">
          {payeeName(p)}
          {p.payee && !p.worker && (
            <span className="ml-1.5 text-[9px] font-extrabold uppercase tracking-wide text-mine-400 bg-mine-800 rounded px-1.5 py-0.5">
              {t("payroll.payeeModeCompany")}
            </span>
          )}
        </span>
      ),
      sortValue: (p) => payeeName(p),
    },
    { key: "period", header: t("payroll.payPeriod"), render: (p) => `${new Date(p.payPeriodStart).toLocaleDateString()} – ${new Date(p.payPeriodEnd).toLocaleDateString()}`, sortValue: (p) => p.payPeriodStart },
    { key: "gross", header: t("payroll.grossPay"), render: (p) => p.grossPay.toLocaleString(), sortValue: (p) => p.grossPay },
    { key: "net", header: t("payroll.netPay"), render: (p) => p.netPay.toLocaleString(), sortValue: (p) => p.netPay },
  ];

  return (
    <div className="space-y-4">
      {canEdit && (workers.length > 0 || companyPayees.length > 0) && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("payroll.newPayslip")}</button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={payslips}
        rowKey={(p) => p.id}
        emptyMessage={t("payroll.noneYetPayslips")}
        searchValue={(p) => payeeName(p)}
        exportFilename="payslips"
        exportColumns={[
          { header: t("payroll.payee"), value: (p) => payeeName(p) },
          { header: t("payroll.payPeriod"), value: (p) => `${p.payPeriodStart} - ${p.payPeriodEnd}` },
          { header: t("payroll.grossPay"), value: (p) => p.grossPay },
          { header: t("payroll.netPay"), value: (p) => p.netPay },
        ]}
        actions={(p) => (
          <div className="flex justify-end gap-2">
            {p.fileName && (
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => download(p)}>{t("documents.download")}</button>
            )}
            {canDelete && (
              <button className={buttonDanger} onClick={() => remove(p.id)}>{t("common.delete")}</button>
            )}
          </div>
        )}
      />
      {modal && (
        <Modal title={t("payroll.newPayslipTitle")} onClose={() => setModal(false)}>
          <PayslipForm workers={workers} companyPayees={companyPayees} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function LeaveBalanceForm({ workers, initial, onSubmit, onCancel }: {
  workers: Worker[];
  initial?: Partial<LeaveBalance>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [leaveType, setLeaveType] = useState<LeaveType>(initial?.leaveType ?? "ANNUAL");
  const [cycleStartDate, setCycleStartDate] = useState(initial?.cycleStartDate?.slice(0, 10) ?? "");
  const [cycleEndDate, setCycleEndDate] = useState(initial?.cycleEndDate?.slice(0, 10) ?? "");
  const [entitlementDays, setEntitlementDays] = useState(initial?.entitlementDays?.toString() ?? "15");
  const [carriedOverDays, setCarriedOverDays] = useState(initial?.carriedOverDays?.toString() ?? "0");
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
  const [modal, setModal] = useState<null | "create" | LeaveBalance>(null);

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
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/payroll/leave-balances/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/payroll/leave-balances/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<LeaveBalance>[] = [
    { key: "worker", header: t("workers.title"), render: (b) => <span className="font-medium">{b.worker?.name}</span>, sortValue: (b) => b.worker?.name ?? "" },
    { key: "type", header: t("payroll.leaveType"), render: (b) => t(`payroll.leaveTypes.${b.leaveType}`), sortValue: (b) => b.leaveType },
    { key: "entitlement", header: t("payroll.leaveBalances.entitlementDays"), render: (b) => (b.entitlementDays + b.carriedOverDays).toFixed(1), sortValue: (b) => b.entitlementDays + b.carriedOverDays },
    { key: "taken", header: t("payroll.leaveBalances.takenDays"), render: (b) => b.takenDays.toFixed(1), sortValue: (b) => b.takenDays },
    { key: "remaining", header: t("payroll.leaveBalances.remainingDays"), render: (b) => <span className={b.remainingDays < 0 ? "text-danger-500 font-medium" : ""}>{b.remainingDays.toFixed(1)}</span>, sortValue: (b) => b.remainingDays },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("payroll.leaveBalances.hint")}</p>
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("payroll.leaveBalances.new")}</button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={balances}
        rowKey={(b) => b.id}
        emptyMessage={t("payroll.leaveBalances.noneYet")}
        searchValue={(b) => `${b.worker?.name ?? ""} ${b.leaveType}`}
        exportFilename="leave-balances"
        exportColumns={[
          { header: t("workers.title"), value: (b) => b.worker?.name ?? "" },
          { header: t("payroll.leaveType"), value: (b) => b.leaveType },
          { header: t("payroll.leaveBalances.entitlementDays"), value: (b) => b.entitlementDays + b.carriedOverDays },
          { header: t("payroll.leaveBalances.takenDays"), value: (b) => b.takenDays },
          { header: t("payroll.leaveBalances.remainingDays"), value: (b) => b.remainingDays },
        ]}
        actions={(b) => (
          <div className="flex justify-end gap-2">
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(b)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(b.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("payroll.leaveBalances.newTitle") : t("payroll.leaveBalances.editTitle")} onClose={() => setModal(null)}>
          <LeaveBalanceForm
            workers={workers}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
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

  const columns: DataTableColumn<BceaBreach>[] = [
    { key: "worker", header: t("workers.title"), render: (b) => <span className="font-medium">{b.workerName}</span>, sortValue: (b) => b.workerName },
    { key: "type", header: t("payroll.bceaCompliance.breachType"), render: (b) => <span className="text-danger-500">{t(`payroll.bceaCompliance.breachTypes.${b.type}`)}</span>, sortValue: (b) => b.type },
    { key: "detail", header: t("common.description"), render: (b) => b.detail },
  ];

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
        <DataTable
          columns={columns}
          rows={report.breaches}
          rowKey={(b) => `${b.workerId}-${b.type}-${b.detail}`}
          emptyMessage={t("payroll.bceaCompliance.noBreaches")}
          searchValue={(b) => `${b.workerName} ${b.type} ${b.detail}`}
          exportFilename="bcea-breaches"
          exportColumns={[
            { header: t("workers.title"), value: (b) => b.workerName },
            { header: t("payroll.bceaCompliance.breachType"), value: (b) => b.type },
            { header: t("common.description"), value: (b) => b.detail },
          ]}
        />
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
