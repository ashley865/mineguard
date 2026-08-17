import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { RegulatorySubmission, RegulatorySubmissionStatus } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import FileDropzone from "../components/FileDropzone";
import LoadError from "../components/LoadError";

const statuses: RegulatorySubmissionStatus[] = ["DRAFT", "SUBMITTED", "ACKNOWLEDGED", "OVERDUE"];

function SubmissionForm({ onSubmit, onCancel }: { onSubmit: (form: FormData) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [regulator, setRegulator] = useState("");
  const [subject, setSubject] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("regulator", regulator);
      form.append("subject", subject);
      if (referenceNumber) form.append("referenceNumber", referenceNumber);
      if (dueDate) form.append("dueDate", dueDate);
      if (notes) form.append("notes", notes);
      if (file) form.append("file", file);
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("regulatorySubmissions.regulator")}</label>
          <input className={inputClass} value={regulator} onChange={(e) => setRegulator(e.target.value)} placeholder="DMRE" required />
        </div>
        <div>
          <label className={labelClass}>{t("regulatorySubmissions.referenceNumber")}</label>
          <input className={inputClass} value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("executiveRequests.subject")}</label>
        <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("regulatorySubmissions.dueDate")}</label>
        <DateField value={dueDate} onChange={setDueDate} />
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("regulatorySubmissions.attachment")}</label>
        <FileDropzone accept="image/*,.pdf,.doc,.docx" onFiles={(files) => setFile(files.item(0))} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function RegulatorySubmissions() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [submissions, setSubmissions] = useState<RegulatorySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<RegulatorySubmission[]>("/regulatory-submissions");
      setSubmissions(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(form: FormData) {
    await api.post("/regulatory-submissions", form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(false);
    await load();
  }

  async function updateStatus(id: string, status: RegulatorySubmissionStatus) {
    await api.put(`/regulatory-submissions/${id}`, {
      status,
      submittedDate: status === "SUBMITTED" ? new Date().toISOString() : undefined,
    });
    await load();
  }

  async function download(s: RegulatorySubmission) {
    const res = await api.get(`/regulatory-submissions/${s.id}/attachment`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = s.fileName ?? "attachment";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async function remove(id: string) {
    if (!confirm(t("regulatorySubmissions.confirmDelete"))) return;
    await api.delete(`/regulatory-submissions/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("regulatorySubmissions.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("regulatorySubmissions.subtitle")}</p>
        </div>
        {canEdit && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("regulatorySubmissions.new")}</button>
        )}
      </div>

      <div className="space-y-3">
        {submissions.map((s) => (
          <div key={s.id} className={`${cardClass} p-4 space-y-2`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] uppercase tracking-wide text-mine-400 bg-mine-800 px-2 py-0.5 rounded-full">{s.regulator}</span>
                  <StatusBadge status={s.status} />
                  {s.dueDate && <span className="text-xs text-mine-400">{t("regulatorySubmissions.dueDate")}: {new Date(s.dueDate).toLocaleDateString()}</span>}
                </div>
                <div className="text-sm font-semibold">{s.subject}</div>
                {s.referenceNumber && <div className="text-xs text-mine-400 mt-0.5">{t("regulatorySubmissions.referenceNumber")}: {s.referenceNumber}</div>}
              </div>
              {canEdit && <button className={buttonDanger} onClick={() => remove(s.id)}>{t("common.delete")}</button>}
            </div>
            {s.notes && <p className="text-sm text-mine-200 whitespace-pre-line">{s.notes}</p>}
            <div className="flex items-center justify-between gap-2 border-t border-mine-800 pt-2">
              {s.fileName ? (
                <button className="text-xs text-hazard-400 hover:text-hazard-300" onClick={() => download(s)}>📎 {s.fileName}</button>
              ) : <span />}
              {canEdit && (
                <div className="flex gap-2">
                  {statuses.filter((st) => st !== s.status).map((st) => (
                    <button key={st} className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => updateStatus(s.id, st)}>
                      {t(`regulatorySubmissions.statuses.${st}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {submissions.length === 0 && (
          <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("regulatorySubmissions.noneYet")}</div>
        )}
      </div>

      {modal && (
        <Modal title={t("regulatorySubmissions.newTitle")} onClose={() => setModal(false)}>
          <SubmissionForm onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
