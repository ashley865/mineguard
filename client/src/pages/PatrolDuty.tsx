import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { PatrolAssignment } from "../api/types";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import Modal from "../components/Modal";

interface Guard {
  id: string;
  name: string;
  employeeId: string;
  status: string;
}

function storageKey(siteId: string) {
  return `mineguard_patrol_guard_${siteId}`;
}

function CheckpointCapture({ label, onSubmit, onCancel }: {
  label: string;
  onSubmit: (photo: File | null, notes: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function handleFile(files: FileList | null) {
    const file = files?.item(0) ?? null;
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(photo, notes);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-mine-300">{label}</p>
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
        />
        {preview ? (
          <img src={preview} alt="" className="w-full max-h-56 object-cover rounded-md border border-mine-800" />
        ) : (
          <button type="button" className={`${buttonSecondary} w-full`} onClick={() => fileRef.current?.click()}>
            {t("patrol.duty.takePhoto")}
          </button>
        )}
        {preview && (
          <button type="button" className="text-xs text-mine-400 mt-1" onClick={() => fileRef.current?.click()}>
            {t("patrol.duty.retakePhoto")}
          </button>
        )}
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

function EvacuationForm({ onSubmit, onCancel }: {
  onSubmit: (assemblyPoint: string, message: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [assemblyPoint, setAssemblyPoint] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(assemblyPoint, message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-danger-500 font-semibold">{t("patrol.duty.evacuationWarning")}</p>
      <div>
        <label className={labelClass}>{t("emergency.assemblyPoint")}</label>
        <input className={inputClass} value={assemblyPoint} onChange={(e) => setAssemblyPoint(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonDanger} disabled={saving}>{saving ? t("common.saving") : t("patrol.duty.confirmEvacuation")}</button>
      </div>
    </form>
  );
}

export default function PatrolDuty() {
  const { t } = useTranslation();
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<{ id: string; name: string } | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [guardId, setGuardId] = useState<string>("");
  const [onDuty, setOnDuty] = useState(false);
  const [assignment, setAssignment] = useState<PatrolAssignment | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkpointModal, setCheckpointModal] = useState<null | { id: string; name: string }>(null);
  const [photoModal, setPhotoModal] = useState(false);
  const [evacuationModal, setEvacuationModal] = useState(false);
  const [evacuationSent, setEvacuationSent] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    api
      .get(`/patrol/public/${siteId}/guards`)
      .then((res) => {
        setSite(res.data.site);
        setGuards(res.data.guards);
        const saved = localStorage.getItem(storageKey(siteId));
        if (saved && res.data.guards.some((g: Guard) => g.id === saved)) setGuardId(saved);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [siteId]);

  async function loadDuty() {
    if (!siteId || !guardId) return;
    const res = await api.get(`/patrol/public/${siteId}/duty/${guardId}`);
    setOnDuty(res.data.onDuty);
    setAssignment(res.data.assignment);
  }

  useEffect(() => {
    if (guardId && siteId) {
      localStorage.setItem(storageKey(siteId), guardId);
      loadDuty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardId, siteId]);

  async function toggleDuty() {
    if (!siteId || !guardId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/patrol/public/${siteId}/duty/${guardId}/toggle`);
      await loadDuty();
    } catch {
      setError(t("patrol.duty.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function submitCheckpoint(checkpointId: string, photo: File | null, notes: string) {
    if (!siteId || !guardId || !assignment) return;
    const form = new FormData();
    if (photo) form.append("photo", photo);
    if (notes) form.append("notes", notes);
    try {
      await api.post(
        `/patrol/public/${siteId}/duty/${guardId}/assignments/${assignment.id}/checkpoints/${checkpointId}/log`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setCheckpointModal(null);
      await loadDuty();
    } catch {
      setError(t("patrol.duty.genericError"));
    }
  }

  async function submitAdHocPhoto(photo: File | null, notes: string) {
    if (!siteId || !guardId || !assignment || !photo) return;
    const form = new FormData();
    form.append("photo", photo);
    if (notes) form.append("notes", notes);
    try {
      await api.post(`/patrol/public/${siteId}/duty/${guardId}/assignments/${assignment.id}/photo`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPhotoModal(false);
      await loadDuty();
    } catch {
      setError(t("patrol.duty.genericError"));
    }
  }

  async function submitEvacuation(assemblyPoint: string, message: string) {
    if (!siteId || !guardId) return;
    try {
      await api.post(`/patrol/public/${siteId}/evacuate`, { workerId: guardId, assemblyPoint, message: message || undefined });
      setEvacuationModal(false);
      setEvacuationSent(true);
    } catch {
      setError(t("patrol.duty.genericError"));
    }
  }

  if (loading) return <div className="min-h-screen bg-mine-950 flex items-center justify-center text-mine-300">{t("common.loading")}</div>;

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 p-4">
        <div className={`${cardClass} p-6 max-w-md text-center`}>{t("patrol.duty.siteNotFound")}</div>
      </div>
    );
  }

  const guard = guards.find((g) => g.id === guardId);
  const loggedCheckpointIds = new Set((assignment?.logs ?? []).filter((l) => l.checkpointId).map((l) => l.checkpointId));

  return (
    <div className="min-h-screen bg-mine-950 p-4 flex justify-center">
      <div className="w-full max-w-lg space-y-4">
        <div>
          <div className="text-lg font-bold tracking-tight text-white">⛏ Mine Guard</div>
          <h1 className="text-base font-semibold mt-2 text-mine-50">{t("patrol.duty.title")}</h1>
          {site && <p className="text-mine-300 text-sm">{site.name}</p>}
        </div>

        {error && <div className="text-danger-500 text-sm bg-danger-500/10 border border-danger-500/30 rounded-md px-3 py-2">{error}</div>}

        <div className={`${cardClass} p-4 space-y-3`}>
          <label className={labelClass}>{t("patrol.duty.whoAreYou")}</label>
          <select className={selectClass} value={guardId} onChange={(e) => setGuardId(e.target.value)}>
            <option value="">{t("patrol.duty.selectGuard")}</option>
            {guards.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.employeeId})</option>)}
          </select>
          {guards.length === 0 && <p className="text-xs text-mine-400">{t("patrol.duty.noGuards")}</p>}
        </div>

        {guard && (
          <>
            <div className={`${cardClass} p-4 flex items-center justify-between gap-3`}>
              <div>
                <div className="font-semibold text-mine-50">{guard.name}</div>
                <div className="text-xs text-mine-400">{onDuty ? t("patrol.duty.onDuty") : t("patrol.duty.offDuty")}</div>
              </div>
              <button className={onDuty ? buttonSecondary : buttonPrimary} disabled={busy} onClick={toggleDuty}>
                {onDuty ? t("patrol.duty.reportOffDuty") : t("patrol.duty.reportOnDuty")}
              </button>
            </div>

            {assignment ? (
              <div className={`${cardClass} p-4 space-y-3`}>
                <div>
                  <div className="text-xs text-mine-400 uppercase tracking-wide">{t("patrol.duty.assignedRoute")}</div>
                  <div className="font-semibold text-mine-50">{assignment.route.name}</div>
                </div>
                <div className="space-y-2">
                  {assignment.route.checkpoints.map((cp) => {
                    const done = loggedCheckpointIds.has(cp.id);
                    return (
                      <div key={cp.id} className="flex items-center justify-between gap-2 border-t border-mine-800 pt-2 first:border-t-0 first:pt-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${done ? "bg-success-600 text-white" : "bg-mine-700 text-mine-300"}`}>
                            {cp.sequence}
                          </span>
                          <span className={done ? "text-mine-300 line-through" : "text-mine-50"}>{cp.name}</span>
                        </div>
                        <button
                          className={`${buttonSecondary} text-xs px-3 py-1`}
                          onClick={() => setCheckpointModal({ id: cp.id, name: cp.name })}
                        >
                          {done ? t("patrol.duty.logAgain") : t("patrol.duty.checkIn")}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button className={`${buttonSecondary} w-full`} onClick={() => setPhotoModal(true)}>
                  {t("patrol.duty.reportObservation")}
                </button>
              </div>
            ) : (
              <div className={`${cardClass} p-4 text-center text-mine-400 text-sm`}>{t("patrol.duty.noAssignment")}</div>
            )}

            {evacuationSent ? (
              <div className={`${cardClass} p-4 text-center text-danger-500 font-semibold`}>{t("patrol.duty.evacuationSent")}</div>
            ) : (
              <button className={`${buttonDanger} w-full py-3 text-base`} onClick={() => setEvacuationModal(true)}>
                {t("patrol.duty.triggerEvacuation")}
              </button>
            )}
          </>
        )}
      </div>

      {checkpointModal && (
        <Modal title={checkpointModal.name} onClose={() => setCheckpointModal(null)}>
          <CheckpointCapture
            label={t("patrol.duty.checkpointHint")}
            onSubmit={(photo, notes) => submitCheckpoint(checkpointModal.id, photo, notes)}
            onCancel={() => setCheckpointModal(null)}
          />
        </Modal>
      )}

      {photoModal && (
        <Modal title={t("patrol.duty.reportObservation")} onClose={() => setPhotoModal(false)}>
          <CheckpointCapture
            label={t("patrol.duty.observationHint")}
            onSubmit={(photo, notes) => submitAdHocPhoto(photo, notes)}
            onCancel={() => setPhotoModal(false)}
          />
        </Modal>
      )}

      {evacuationModal && (
        <Modal title={t("patrol.duty.triggerEvacuation")} onClose={() => setEvacuationModal(false)}>
          <EvacuationForm onSubmit={submitEvacuation} onCancel={() => setEvacuationModal(false)} />
        </Modal>
      )}
    </div>
  );
}
