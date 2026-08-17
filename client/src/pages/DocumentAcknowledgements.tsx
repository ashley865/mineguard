import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { DocumentAcknowledgement, MineDocument, Worker } from "../api/types";
import { buttonDanger, buttonPrimary, cardClass, selectClass } from "../components/ui";
import LoadError from "../components/LoadError";

export default function DocumentAcknowledgements() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [documents, setDocuments] = useState<MineDocument[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [acknowledgements, setAcknowledgements] = useState<DocumentAcknowledgement[]>([]);
  const [addWorkerId, setAddWorkerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadBase() {
    setLoading(true);
    setLoadError(false);
    try {
      const [d, w] = await Promise.all([
        api.get<MineDocument[]>("/documents"),
        api.get<Worker[]>("/workers"),
      ]);
      setDocuments(d.data);
      setWorkers(w.data);
      if (d.data.length > 0) setDocumentId(d.data[0].id);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadAcknowledgements(docId: string) {
    if (!docId) return;
    const res = await api.get<DocumentAcknowledgement[]>("/document-acknowledgements", { params: { documentId: docId } });
    setAcknowledgements(res.data);
  }

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (documentId) loadAcknowledgements(documentId); }, [documentId]);

  async function addAcknowledgement() {
    if (!addWorkerId) return;
    setSaving(true);
    try {
      await api.post("/document-acknowledgements", { documentId, workerId: addWorkerId });
      setAddWorkerId("");
      await loadAcknowledgements(documentId);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/document-acknowledgements/${id}`);
    await loadAcknowledgements(documentId);
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={loadBase} />;

  const acknowledgedWorkerIds = new Set(acknowledgements.map((a) => a.workerId));
  const notYetAcknowledged = workers.filter((w) => !acknowledgedWorkerIds.has(w.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("documentAcknowledgements.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("documentAcknowledgements.subtitle")}</p>
      </div>

      {documents.length === 0 ? (
        <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("documentAcknowledgements.noDocuments")}</div>
      ) : (
        <>
          <div>
            <select className={`${selectClass} max-w-md`} value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
              {documents.map((d) => <option key={d.id} value={d.id}>{d.title} (v{d.version})</option>)}
            </select>
          </div>

          {canEdit && notYetAcknowledged.length > 0 && (
            <div className="flex items-center gap-2">
              <select className={`${selectClass} max-w-xs`} value={addWorkerId} onChange={(e) => setAddWorkerId(e.target.value)}>
                <option value="">{t("documentAcknowledgements.selectWorker")}</option>
                {notYetAcknowledged.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button className={buttonPrimary} disabled={!addWorkerId || saving} onClick={addAcknowledgement}>
                {t("documentAcknowledgements.recordAcknowledgement")}
              </button>
            </div>
          )}

          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("workers.title")}</th>
                  <th className="text-left px-4 py-2">{t("documentAcknowledgements.acknowledgedDate")}</th>
                  <th className="text-left px-4 py-2">{t("documentAcknowledgements.recordedBy")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {acknowledgements.map((a) => (
                  <tr key={a.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                    <td className="px-4 py-2 font-medium">{a.worker.name}</td>
                    <td className="px-4 py-2 text-mine-300">{new Date(a.acknowledgedDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-mine-300">{a.recordedBy?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {canEdit && <button className={buttonDanger} onClick={() => remove(a.id)}>{t("common.delete")}</button>}
                    </td>
                  </tr>
                ))}
                {acknowledgements.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-mine-400">{t("documentAcknowledgements.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-mine-400">
            {t("documentAcknowledgements.coverage", { acknowledged: acknowledgements.length, total: workers.length })}
          </p>
        </>
      )}
    </div>
  );
}
