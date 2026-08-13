import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { PatrolAssignment, PatrolObservationCategory } from "../../api/types";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../ui";
import Modal from "../Modal";

const observationCategories: PatrolObservationCategory[] = [
  "GENERAL_OBSERVATION",
  "SAFETY_HAZARD",
  "SUSPICIOUS_ACTIVITY",
  "SECURITY_CONCERN",
  "MAINTENANCE_ISSUE",
  "OTHER",
];

function CheckpointCapture({ label, showCategory, onSubmit, onCancel }: {
  label: string;
  showCategory?: boolean;
  onSubmit: (photo: File | null, notes: string, category?: PatrolObservationCategory) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<PatrolObservationCategory>("GENERAL_OBSERVATION");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(files: FileList | null) {
    const file = files?.item(0) ?? null;
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (showCategory && !photo && !notes.trim()) {
      setError(t("patrol.duty.observationRequiresContent"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(photo, notes, showCategory ? category : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-mine-300">{label}</p>
      {showCategory && (
        <div>
          <label className={labelClass}>{t("patrol.duty.observationCategory")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as PatrolObservationCategory)}>
            {observationCategories.map((c) => <option key={c} value={c}>{t(`patrol.duty.observationCategories.${c}`)}</option>)}
          </select>
        </div>
      )}
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
      {error && <div className="text-danger-500 text-xs">{error}</div>}
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

// Shared by both guard-facing duty pages: the site-wide picker link (PatrolDuty.tsx) and
// each guard's personal secure link (PatrolDutyLink.tsx). Everything from "report for
// duty" onward — toggling duty, checkpoint/observation photos, evacuation — lives here
// once, so the two entry points differ only in how the guard's identity is established.
export default function GuardDutyPanel({ siteId, guardId, guardName }: {
  siteId: string;
  guardId: string;
  guardName: string;
}) {
  const { t } = useTranslation();
  const [onDuty, setOnDuty] = useState(false);
  const [assignment, setAssignment] = useState<PatrolAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkpointModal, setCheckpointModal] = useState<null | { id: string; name: string }>(null);
  const [photoModal, setPhotoModal] = useState(false);
  const [evacuationModal, setEvacuationModal] = useState(false);
  const [evacuationSent, setEvacuationSent] = useState(false);

  async function loadDuty() {
    const res = await api.get(`/patrol/public/${siteId}/duty/${guardId}`);
    setOnDuty(res.data.onDuty);
    setAssignment(res.data.assignment);
    setLoading(false);
  }

  useEffect(() => {
    loadDuty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, guardId]);

  async function toggleDuty() {
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
    if (!assignment) return;
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

  // A guard may have no assignment for the day (or be reporting something unrelated to
  // their route) — this always works regardless of assignment state, unlike checkpoint
  // check-ins which are necessarily tied to an assigned route.
  async function submitAdHocPhoto(photo: File | null, notes: string, category?: PatrolObservationCategory) {
    const form = new FormData();
    if (photo) form.append("photo", photo);
    if (notes) form.append("notes", notes);
    if (category) form.append("category", category);
    try {
      const position = await getPosition();
      if (position) {
        form.append("latitude", String(position.coords.latitude));
        form.append("longitude", String(position.coords.longitude));
      }
      await api.post(`/patrol/public/${siteId}/duty/${guardId}/observation`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPhotoModal(false);
      await loadDuty();
    } catch {
      setError(t("patrol.duty.genericError"));
    }
  }

  function getPosition(): Promise<GeolocationPosition | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 3000 });
    });
  }

  async function submitEvacuation(assemblyPoint: string, message: string) {
    try {
      await api.post(`/patrol/public/${siteId}/evacuate`, { workerId: guardId, assemblyPoint, message: message || undefined });
      setEvacuationModal(false);
      setEvacuationSent(true);
    } catch {
      setError(t("patrol.duty.genericError"));
    }
  }

  if (loading) return <div className="text-mine-300 text-sm">{t("common.loading")}</div>;

  const loggedCheckpointIds = new Set((assignment?.logs ?? []).filter((l) => l.checkpointId).map((l) => l.checkpointId));

  return (
    <div className="space-y-4">
      {error && <div className="text-danger-500 text-sm bg-danger-500/10 border border-danger-500/30 rounded-md px-3 py-2">{error}</div>}

      <div className={`${cardClass} p-4 flex items-center justify-between gap-3`}>
        <div>
          <div className="font-semibold text-mine-50">{guardName}</div>
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
        </div>
      ) : (
        <div className={`${cardClass} p-4 text-center text-mine-400 text-sm`}>{t("patrol.duty.noAssignment")}</div>
      )}

      <button className={`${buttonSecondary} w-full`} onClick={() => setPhotoModal(true)}>
        {t("patrol.duty.reportObservation")}
      </button>

      {evacuationSent ? (
        <div className={`${cardClass} p-4 text-center text-danger-500 font-semibold`}>{t("patrol.duty.evacuationSent")}</div>
      ) : (
        <button className={`${buttonDanger} w-full py-3 text-base`} onClick={() => setEvacuationModal(true)}>
          {t("patrol.duty.triggerEvacuation")}
        </button>
      )}

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
            showCategory
            onSubmit={(photo, notes, category) => submitAdHocPhoto(photo, notes, category)}
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
