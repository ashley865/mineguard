import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  Certificate,
  PpeType,
  TrainingRecord,
  Worker,
  WorkerPpeRequirement,
  WorkerSafetySummary,
} from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, selectClass } from "../../components/ui";

const ppeTypes: PpeType[] = [
  "HARD_HAT",
  "SAFETY_BOOTS",
  "HI_VIS_VEST",
  "SAFETY_GLASSES",
  "HEARING_PROTECTION",
  "RESPIRATOR",
  "GLOVES",
  "FALL_PROTECTION_HARNESS",
  "FACE_SHIELD",
  "DUST_MASK",
  "OTHER",
];

function CountFlag({ count, label, tone }: { count: number; label: string; tone: "danger" | "hazard" }) {
  if (count === 0) return null;
  const cls = tone === "danger" ? "bg-danger-500/15 text-danger-500 border-danger-500/30" : "bg-hazard-500/15 text-hazard-600 border-hazard-500/30";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{count} {label}</span>;
}

function WorkerSafetyDetail({ worker, canManage, onClose }: { worker: Worker; canManage: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [ppe, setPpe] = useState<WorkerPpeRequirement[]>([]);
  const [newPpeType, setNewPpeType] = useState<PpeType>("HARD_HAT");

  async function load() {
    setLoading(true);
    const [c, tr, p] = await Promise.all([
      api.get<Certificate[]>("/certificates", { params: { workerId: worker.id } }),
      api.get<TrainingRecord[]>("/training-records", { params: { workerId: worker.id } }),
      api.get<WorkerPpeRequirement[]>("/worker-safety/ppe", { params: { workerId: worker.id } }),
    ]);
    setCertificates(c.data);
    setTraining(tr.data);
    setPpe(p.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker.id]);

  async function addPpe() {
    if (ppe.some((p) => p.ppeType === newPpeType)) return;
    await api.post("/worker-safety/ppe", { workerId: worker.id, ppeType: newPpeType, isRequired: true, isIssued: false });
    await load();
  }

  async function toggleIssued(item: WorkerPpeRequirement) {
    await api.put(`/worker-safety/ppe/${item.id}`, { isIssued: !item.isIssued, issuedDate: !item.isIssued ? new Date().toISOString() : null });
    await load();
  }

  async function removePpe(id: string) {
    await api.delete(`/worker-safety/ppe/${id}`);
    await load();
  }

  const availablePpeTypes = ppeTypes.filter((pt) => !ppe.some((p) => p.ppeType === pt));

  return (
    <Modal title={`${worker.name} (${worker.employeeId})`} onClose={onClose} size="lg">
      {loading ? (
        <div className="text-mine-300 text-sm">{t("common.loading")}</div>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-mine-300 uppercase mb-1.5">{t("workforce.safety.sectionCertificates")}</div>
            {certificates.length === 0 ? (
              <p className="text-xs text-mine-400">{t("workforce.cert.noneYet")}</p>
            ) : (
              <div className="space-y-1 text-xs">
                {certificates.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-t border-mine-800 pt-1 first:border-t-0 first:pt-0">
                    <span>{t(`workforce.cert.types.${c.type}`)} — {c.certificateNumber}</span>
                    <span className="text-mine-400">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-mine-300 uppercase mb-1.5">{t("workforce.safety.sectionTraining")}</div>
            {training.length === 0 ? (
              <p className="text-xs text-mine-400">{t("workforce.training.noneYet")}</p>
            ) : (
              <div className="space-y-1 text-xs">
                {training.map((tr) => (
                  <div key={tr.id} className="flex items-center justify-between border-t border-mine-800 pt-1 first:border-t-0 first:pt-0">
                    <span>{tr.courseName} ({t(`workforce.training.types.${tr.trainingType}`)})</span>
                    <span className="text-mine-400">{tr.expiryDate ? new Date(tr.expiryDate).toLocaleDateString() : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-mine-300 uppercase mb-1.5">{t("workforce.safety.sectionPpe")}</div>
            <div className="space-y-1">
              {ppe.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1 first:border-t-0 first:pt-0">
                  <span>{t(`workforce.safety.ppeTypes.${p.ppeType}`)}</span>
                  <div className="flex items-center gap-2">
                    {canManage ? (
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={p.isIssued} onChange={() => toggleIssued(p)} />
                        {t("workforce.safety.issued")}
                      </label>
                    ) : (
                      <span className={p.isIssued ? "text-success-500" : "text-danger-500"}>
                        {p.isIssued ? t("workforce.safety.issued") : t("workforce.safety.notIssued")}
                      </span>
                    )}
                    {canManage && (
                      <button className="text-danger-500" onClick={() => removePpe(p.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </div>
              ))}
              {ppe.length === 0 && <p className="text-xs text-mine-400">{t("workforce.safety.noPpeYet")}</p>}
            </div>
            {canManage && availablePpeTypes.length > 0 && (
              <div className="flex gap-2 mt-2">
                <select className={selectClass} value={newPpeType} onChange={(e) => setNewPpeType(e.target.value as PpeType)}>
                  {availablePpeTypes.map((pt) => <option key={pt} value={pt}>{t(`workforce.safety.ppeTypes.${pt}`)}</option>)}
                </select>
                <button type="button" className={buttonSecondary} onClick={addPpe}>{t("common.add")}</button>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button className={buttonPrimary} onClick={onClose}>{t("common.close")}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function WorkerSafetyTab({ workers }: { workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [summary, setSummary] = useState<WorkerSafetySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<WorkerSafetySummary[]>("/worker-safety/summary");
    setSummary(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="text-mine-300">{t("workforce.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("workforce.safety.subtitle")}</p>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workforce.safety.colWorker")}</th>
              <th className="text-left px-4 py-2">{t("workforce.safety.colCertificates")}</th>
              <th className="text-left px-4 py-2">{t("workforce.safety.colTraining")}</th>
              <th className="text-left px-4 py-2">{t("workforce.safety.colCompliance")}</th>
              <th className="text-left px-4 py-2">{t("workforce.safety.colMedical")}</th>
              <th className="text-left px-4 py-2">{t("workforce.safety.colPpe")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => (
              <tr key={row.worker.id} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                <td className="px-4 py-2 font-medium">
                  {row.worker.name}
                  <div className="text-[10px] text-mine-400">{row.worker.employeeId}</div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-mine-300">{row.certificates.total}</span>
                    <CountFlag count={row.certificates.expired} label={t("workforce.safety.expired")} tone="danger" />
                    <CountFlag count={row.certificates.expiringSoon} label={t("workforce.safety.expiringSoon")} tone="hazard" />
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-mine-300">{row.training.total}</span>
                    <CountFlag count={row.training.expired} label={t("workforce.safety.expired")} tone="danger" />
                    <CountFlag count={row.training.expiringSoon} label={t("workforce.safety.expiringSoon")} tone="hazard" />
                  </div>
                </td>
                <td className="px-4 py-2 text-xs">
                  {row.compliance ? (
                    <span className={[row.compliance.isProperlyTrained, row.compliance.isCompetent, row.compliance.isCertified, row.compliance.isAuthorised, row.compliance.isAssignedPermittedTasks, row.compliance.isTrainingUpToDate].every(Boolean) ? "text-success-500" : "text-hazard-600"}>
                      {[row.compliance.isProperlyTrained, row.compliance.isCompetent, row.compliance.isCertified, row.compliance.isAuthorised, row.compliance.isAssignedPermittedTasks, row.compliance.isTrainingUpToDate].filter(Boolean).length}/6
                    </span>
                  ) : (
                    <span className="text-mine-400">{t("workforce.safety.noneYet")}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {row.medical ? <StatusBadge status={row.medical.result} /> : <span className="text-mine-400 text-xs">{t("workforce.safety.noneYet")}</span>}
                </td>
                <td className="px-4 py-2 text-xs">
                  {row.ppe.total === 0 ? (
                    <span className="text-mine-400">{t("workforce.safety.noneYet")}</span>
                  ) : (
                    <>
                      <span className="text-mine-300">{row.ppe.total}</span>
                      <CountFlag count={row.ppe.missing} label={t("workforce.safety.missing")} tone="danger" />
                    </>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    className="text-xs text-mine-300 hover:text-mine-50"
                    onClick={() => setSelectedWorker(workers.find((w) => w.id === row.worker.id) ?? null)}
                  >
                    {t("workforce.safety.viewProfile")}
                  </button>
                </td>
              </tr>
            ))}
            {summary.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("workforce.safety.noWorkers")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedWorker && (
        <WorkerSafetyDetail worker={selectedWorker} canManage={canManage} onClose={() => { setSelectedWorker(null); load(); }} />
      )}
    </div>
  );
}
