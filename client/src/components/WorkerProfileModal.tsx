import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, API_URL } from "../api/client";
import { Worker, WorkerProfile } from "../api/types";
import { StatusBadge } from "./Badges";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { buttonSecondary, cardClass } from "./ui";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={`${cardClass} px-3 py-2`}>
      <div className="text-[10px] text-mine-400 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${cardClass} p-3`}>
      <div className="text-xs font-semibold text-mine-300 uppercase mb-2">{title}</div>
      {children}
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
    <Modal title={t("workers.profileTitle", { name: worker.name })} onClose={onClose} size="lg">
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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <StatBlock label={t("workers.daysWorked90")} value={profile.stats.daysWorkedLast90} />
              <StatBlock label={t("workers.shifts90")} value={profile.stats.shiftsLast90} />
              <StatBlock label={t("workers.avgHours")} value={profile.stats.avgHoursPerShift ?? "—"} />
              <StatBlock label={t("workers.activeCerts")} value={`${profile.stats.activeCertificates}/${profile.stats.totalCertificates}`} />
              <StatBlock label={t("workers.trainingCompleted")} value={profile.stats.trainingCompleted} />
              <StatBlock label={t("workers.lastMedical")} value={profile.stats.latestMedicalResult ? t(`badges.status.${profile.stats.latestMedicalResult}`) : "—"} />
              <StatBlock label={t("workers.leaveDaysYear")} value={profile.stats.leaveDaysTakenThisYear} />
            </div>

            <SectionCard title={t("workers.hoursLast30")}>
              {profile.dailyHoursLast30.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noAttendance")}</div>
              ) : (
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profile.dailyHoursLast30}>
                      <XAxis dataKey="date" tick={CHART_TICK_STYLE} tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" />
                      <YAxis tick={CHART_TICK_STYLE} allowDecimals={false} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Bar dataKey="hours" fill="#c48a1f" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.contactInfo")}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-mine-400">{t("common.phone")}:</span> {worker.phone ?? "—"}</div>
                <div><span className="text-mine-400">{t("workers.manager")}:</span> {worker.manager?.name ?? "—"}</div>
                <div><span className="text-mine-400">{t("workers.nextOfKin")}:</span> {worker.nextOfKinName ?? "—"}</div>
                <div><span className="text-mine-400">{t("workers.nextOfKinRelationship")}:</span> {worker.nextOfKinRelationship ?? "—"}</div>
                <div><span className="text-mine-400">{t("workers.nextOfKinPhone")}:</span> {worker.nextOfKinPhone ?? "—"}</div>
              </div>
            </SectionCard>

            <SectionCard title={t("workers.recentAttendance")}>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {profile.recentAttendance.length === 0 && <div className="text-mine-400 text-xs">{t("workers.noAttendance")}</div>}
                {profile.recentAttendance.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1">
                    <span>{new Date(a.checkInAt).toLocaleString()}</span>
                    <span className="text-mine-400">{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString() : t("workers.stillOnShift")}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title={t("workers.certificatesSection")}>
              {profile.certificates.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noCertificates")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-mine-400 uppercase">
                      <tr>
                        <th className="text-left py-1 pr-2">{t("workforce.cert.colType")}</th>
                        <th className="text-left py-1 pr-2">{t("workforce.cert.colNumber")}</th>
                        <th className="text-left py-1 pr-2">{t("workforce.cert.colExpiry")}</th>
                        <th className="text-left py-1">{t("common.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.certificates.map((c) => (
                        <tr key={c.id} className="border-t border-mine-800">
                          <td className="py-1 pr-2">{t(`workforce.cert.types.${c.type}`)}</td>
                          <td className="py-1 pr-2 text-mine-300">{c.certificateNumber}</td>
                          <td className="py-1 pr-2 text-mine-300">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : "—"}</td>
                          <td className="py-1"><StatusBadge status={c.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.trainingSection")}>
              {profile.trainingRecords.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noTrainingRecords")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-mine-400 uppercase">
                      <tr>
                        <th className="text-left py-1 pr-2">{t("workforce.training.colCourse")}</th>
                        <th className="text-left py-1 pr-2">{t("workforce.training.colType")}</th>
                        <th className="text-left py-1 pr-2">{t("workforce.training.colCompletion")}</th>
                        <th className="text-left py-1">{t("workforce.training.colExpiry")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.trainingRecords.map((tr) => (
                        <tr key={tr.id} className="border-t border-mine-800">
                          <td className="py-1 pr-2">{tr.courseName}</td>
                          <td className="py-1 pr-2 text-mine-300">{t(`workforce.training.types.${tr.trainingType}`)}</td>
                          <td className="py-1 pr-2 text-mine-300">{new Date(tr.completionDate).toLocaleDateString()}</td>
                          <td className="py-1 text-mine-300">{tr.expiryDate ? new Date(tr.expiryDate).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.medicalHistory")}>
              {profile.medicalRecords.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noMedical")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-mine-400 uppercase">
                      <tr>
                        <th className="text-left py-1 pr-2">{t("compliance.medical.colExamType")}</th>
                        <th className="text-left py-1 pr-2">{t("compliance.medical.colExamDate")}</th>
                        <th className="text-left py-1 pr-2">{t("compliance.medical.colResult")}</th>
                        <th className="text-left py-1">{t("compliance.medical.colNextDue")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.medicalRecords.map((m) => (
                        <tr key={m.id} className="border-t border-mine-800">
                          <td className="py-1 pr-2">{t(`compliance.medical.examTypes.${m.examType}`)}</td>
                          <td className="py-1 pr-2 text-mine-300">{new Date(m.examDate).toLocaleDateString()}</td>
                          <td className="py-1 pr-2"><StatusBadge status={m.result} /></td>
                          <td className="py-1 text-mine-300">{new Date(m.nextExamDue).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.leaveSummary")}>
              {Object.keys(profile.leaveDaysByType).length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noLeaveThisYear")}</div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                  {Object.entries(profile.leaveDaysByType).map(([type, days]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-mine-400">{t(`payroll.leaveTypes.${type}`)}</span>
                      <span className="font-semibold">{days}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[10px] font-semibold text-mine-400 uppercase mt-2 mb-1">{t("workers.recentLeave")}</div>
              {profile.recentLeaveRequests.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noLeaveRequests")}</div>
              ) : (
                <div className="space-y-1">
                  {profile.recentLeaveRequests.map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1">
                      <span>{t(`payroll.leaveTypes.${l.leaveType}`)} · {new Date(l.startDate).toLocaleDateString()}–{new Date(l.endDate).toLocaleDateString()}</span>
                      <StatusBadge status={l.status} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.payslipsSection")}>
              {profile.payslips.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noPayslips")}</div>
              ) : (
                <div className="space-y-1">
                  {profile.payslips.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1">
                      <span>
                        {new Date(p.payPeriodStart).toLocaleDateString()} – {new Date(p.payPeriodEnd).toLocaleDateString()}
                        <span className="text-mine-400"> · {t("workers.netPay")}: {p.netPay.toLocaleString()}</span>
                      </span>
                      {p.fileName && (
                        <a
                          className="text-hazard-500 hover:underline"
                          href={`${API_URL}/api/payroll/payslips/${p.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("workers.downloadPayslip")}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}

        <div className="flex justify-end pt-2">
          <button className={buttonSecondary} onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </Modal>
  );
}
