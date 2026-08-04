import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { LeaveRequest, LeaveType, Payslip, Worker } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

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
          <select className={inputClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("payroll.leaveType")}</label>
          <select className={inputClass} value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>
            {leaveTypes.map((lt) => <option key={lt} value={lt}>{t(`payroll.leaveTypes.${lt}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("payroll.startDate")}</label>
          <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("payroll.endDate")}</label>
          <input className={inputClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
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
        <select className={inputClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("payroll.payPeriodStart")}</label>
          <input className={inputClass} type="date" value={payPeriodStart} onChange={(e) => setPayPeriodStart(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("payroll.payPeriodEnd")}</label>
          <input className={inputClass} type="date" value={payPeriodEnd} onChange={(e) => setPayPeriodEnd(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
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
        <input className={inputClass} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<LeaveRequest[]>("/payroll/leave");
    setRequests(res.data);
    setLoading(false);
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
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<Payslip[]>("/payroll/payslips");
    setPayslips(res.data);
    setLoading(false);
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

export default function PayrollLeave() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"leave" | "payslips">("leave");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Worker[]>("/workers").then((res) => {
      setWorkers(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

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
      </div>

      {tab === "leave" && <LeaveTab workers={workers} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "payslips" && <PayslipsTab workers={workers} canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
