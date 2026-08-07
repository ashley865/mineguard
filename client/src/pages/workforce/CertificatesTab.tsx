import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Certificate, CertificateStatus, CertificateType, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const certTypes: CertificateType[] = [
  "MINE_MANAGER",
  "MINE_OVERSEER",
  "SHIFT_SUPERVISOR",
  "BLASTING",
  "ROCK_BREAKER",
  "WINDING_ENGINE_DRIVER",
  "ELECTRICAL",
  "MECHANICAL",
  "OTHER",
];
const certStatuses: CertificateStatus[] = ["ACTIVE", "EXPIRED", "SUSPENDED", "WITHDRAWN"];

function CertificateForm({ workers, initial, onSubmit, onCancel }: {
  workers: Worker[];
  initial?: Partial<Certificate>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [type, setType] = useState<CertificateType>(initial?.type ?? "BLASTING");
  const [certificateNumber, setCertificateNumber] = useState(initial?.certificateNumber ?? "");
  const [issuingBody, setIssuingBody] = useState(initial?.issuingBody ?? "Mine Health and Safety Council");
  const [issueDate, setIssueDate] = useState(initial?.issueDate?.slice(0, 10) ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<CertificateStatus>(initial?.status ?? "ACTIVE");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId,
        type,
        certificateNumber,
        issuingBody,
        issueDate,
        expiryDate: expiryDate || null,
        status,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("workforce.cert.worker")}</label>
        <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("workforce.cert.type")}</label>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as CertificateType)}>
            {certTypes.map((ct) => <option key={ct} value={ct}>{t(`workforce.cert.types.${ct}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("workforce.cert.certificateNumber")}</label>
          <input className={inputClass} value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("workforce.cert.issuingBody")}</label>
        <input className={inputClass} value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("workforce.cert.issueDate")}</label>
          <DateField value={issueDate} onChange={setIssueDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("workforce.cert.expiryDate")}</label>
          <DateField value={expiryDate} onChange={setExpiryDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as CertificateStatus)}>
          {certStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function CertificatesTab({ workers }: { workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | Certificate>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<Certificate[]>("/certificates");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/certificates", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/certificates/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("workforce.cert.confirmDelete"))) return;
    await api.delete(`/certificates/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("workforce.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("workforce.cert.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workforce.cert.colWorker")}</th>
              <th className="text-left px-4 py-2">{t("workforce.cert.colType")}</th>
              <th className="text-left px-4 py-2">{t("workforce.cert.colNumber")}</th>
              <th className="text-left px-4 py-2">{t("workforce.cert.colExpiry")}</th>
              <th className="text-left px-4 py-2">{t("workforce.cert.colStatus")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`workforce.cert.types.${item.type}`)}</td>
                <td className="px-4 py-2 text-mine-300">{item.certificateNumber}</td>
                <td className="px-4 py-2 text-mine-300">
                  {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("workforce.cert.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("workforce.cert.newTitle") : t("workforce.cert.editTitle")} onClose={() => setModal(null)}>
          <CertificateForm
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
