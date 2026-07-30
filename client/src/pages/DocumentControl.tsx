import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { DocumentStatus, DocumentType, MineDocument, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

const docTypes: DocumentType[] = [
  "POLICY",
  "CODE_OF_PRACTICE",
  "PERMIT",
  "CERTIFICATE",
  "REPORT",
  "PROCEDURE",
  "DRAWING",
  "CONTRACT",
  "OTHER",
];
const docStatuses: DocumentStatus[] = ["DRAFT", "ACTIVE", "UNDER_REVIEW", "ARCHIVED", "WITHDRAWN"];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: MineDocument;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<DocumentType>(initial?.type ?? "POLICY");
  const [version, setVersion] = useState(initial?.version ?? "1.0");
  const [status, setStatus] = useState<DocumentStatus>(initial?.status ?? "ACTIVE");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [reviewDate, setReviewDate] = useState(initial?.reviewDate?.slice(0, 10) ?? "");
  const [siteId, setSiteId] = useState(initial?.siteId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit && !file) {
      setError(t("documents.fileRequired"));
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await onSubmit({
          title,
          type,
          version,
          status,
          description: description || undefined,
          reviewDate: reviewDate || null,
          siteId: siteId || null,
        });
      } else {
        const formData = new FormData();
        formData.append("title", title);
        formData.append("type", type);
        formData.append("version", version);
        formData.append("status", status);
        if (description) formData.append("description", description);
        if (reviewDate) formData.append("reviewDate", reviewDate);
        if (siteId) formData.append("siteId", siteId);
        formData.append("file", file as File);
        await onSubmit(formData);
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("documents.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("documents.titleField")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("documents.type")}</label>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
            {docTypes.map((dt) => <option key={dt} value={dt}>{t(`documents.types.${dt}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("documents.version")}</label>
          <input className={inputClass} value={version} onChange={(e) => setVersion(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus)}>
            {docStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("documents.reviewDate")}</label>
          <input className={inputClass} type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("documents.site")}</label>
        <select className={inputClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{t("documents.companyWide")}</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      {!isEdit && (
        <div>
          <label className={labelClass}>{t("documents.file")}</label>
          <input
            className={inputClass}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>
      )}
      {isEdit && (
        <div className="text-xs text-mine-400">
          {t("documents.fileLocked", { fileName: initial?.fileName })}
        </div>
      )}
      {error && <div className="text-danger-400 text-sm">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function DocumentControl() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<MineDocument[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | MineDocument>(null);

  async function load() {
    setLoading(true);
    const [d, s] = await Promise.all([api.get<MineDocument[]>("/documents"), api.get<Site[]>("/sites")]);
    setItems(d.data);
    setSites(s.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: FormData) {
    await api.post("/documents", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/documents/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("documents.confirmDelete"))) return;
    await api.delete(`/documents/${id}`);
    await load();
  }

  async function download(doc: MineDocument) {
    const res = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  if (loading) return <div className="text-mine-300">{t("documents.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t("documents.title")}</h1>
          <p className="text-mine-300 text-sm">{t("documents.subtitle")}</p>
        </div>
        {canEdit && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("documents.new")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("documents.colTitle")}</th>
              <th className="text-left px-4 py-2">{t("documents.colType")}</th>
              <th className="text-left px-4 py-2">{t("documents.colVersion")}</th>
              <th className="text-left px-4 py-2">{t("documents.colSite")}</th>
              <th className="text-left px-4 py-2">{t("documents.colSize")}</th>
              <th className="text-left px-4 py-2">{t("documents.colStatus")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((doc) => (
              <tr key={doc.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">
                  <button className="hover:underline" onClick={() => download(doc)}>{doc.title}</button>
                </td>
                <td className="px-4 py-2 text-mine-300">{t(`documents.types.${doc.type}`)}</td>
                <td className="px-4 py-2 text-mine-300">{doc.version}</td>
                <td className="px-4 py-2 text-mine-300">{doc.site?.name ?? t("documents.companyWide")}</td>
                <td className="px-4 py-2 text-mine-300">{formatFileSize(doc.fileSize)}</td>
                <td className="px-4 py-2"><StatusBadge status={doc.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => download(doc)}>
                      {t("documents.download")}
                    </button>
                    {canEdit && (
                      <>
                        <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(doc)}>{t("common.edit")}</button>
                        <button className={buttonDanger} onClick={() => remove(doc.id)}>{t("common.delete")}</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("documents.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("documents.newTitle") : t("documents.editTitle")} onClose={() => setModal(null)}>
          <DocumentForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
