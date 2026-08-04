import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../api/client";
import { Worker, WorkerProfile } from "../api/types";
import { StatusBadge } from "./Badges";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { buttonSecondary, cardClass } from "./ui";

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={`${cardClass} px-3 py-2`}>
      <div className="text-[10px] text-mine-400 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

export default function WorkerProfileModal({
  worker,
  canEdit,
  onClose,
  onPhotoChanged,
}: {
  worker: Worker;
  canEdit: boolean;
  onClose: () => void;
  onPhotoChanged: () => void;
}) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<WorkerProfile>(`/workers/${worker.id}/profile`);
    setProfile(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker.id]);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      await api.post(`/workers/${worker.id}/photo`, form, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotoVersion((v) => v + 1);
      onPhotoChanged();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal title={t("workers.profileTitle", { name: worker.name })} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar
              size={72}
              name={worker.name}
              src={worker.hasPhoto || photoVersion > 0 ? `${API_URL}/api/workers/${worker.id}/photo?v=${photoVersion}` : null}
            />
            {canEdit && (
              <button
                type="button"
                className="absolute -bottom-1 -right-1 bg-hazard-500 hover:bg-hazard-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label={t("workers.changePhoto") ?? ""}
              >
                +
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
          <div>
            <div className="text-base font-semibold">{worker.name}</div>
            <div className="text-xs text-mine-400">{worker.employeeId} · {worker.role}</div>
            <div className="text-xs text-mine-400">{worker.site?.name}{worker.zone?.name ? ` · ${worker.zone.name}` : ""}</div>
            <div className="mt-1"><StatusBadge status={worker.status} /></div>
          </div>
        </div>

        {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}

        {!loading && profile && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatBlock label={t("workers.daysWorked90")} value={profile.stats.daysWorkedLast90} />
              <StatBlock label={t("workers.shifts90")} value={profile.stats.shiftsLast90} />
              <StatBlock label={t("workers.avgHours")} value={profile.stats.avgHoursPerShift ?? "—"} />
              <StatBlock label={t("workers.activeCerts")} value={`${profile.stats.activeCertificates}/${profile.stats.totalCertificates}`} />
              <StatBlock label={t("workers.trainingCompleted")} value={profile.stats.trainingCompleted} />
              <StatBlock label={t("workers.lastMedical")} value={profile.stats.latestMedicalResult ? t(`badges.status.${profile.stats.latestMedicalResult}`) : "—"} />
            </div>

            <div>
              <div className="text-xs font-semibold text-mine-300 uppercase mb-1.5">{t("workers.recentAttendance")}</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {profile.recentAttendance.length === 0 && <div className="text-mine-400 text-xs">{t("workers.noAttendance")}</div>}
                {profile.recentAttendance.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1">
                    <span>{new Date(a.checkInAt).toLocaleString()}</span>
                    <span className="text-mine-400">{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString() : t("workers.stillOnShift")}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <button className={buttonSecondary} onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </Modal>
  );
}
