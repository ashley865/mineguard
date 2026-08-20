import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, API_URL } from "../api/client";
import { Worker, WorkerProfile } from "../api/types";
import { StatusBadge } from "./Badges";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { buttonSecondary } from "./ui";
import LoadError from "./LoadError";
import {
  ClockIcon,
  RefreshIcon,
  ShieldCheckIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  PalmtreeIcon,
  PhoneIcon,
} from "./icons/DashboardIcons";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };
const cardOuter = "bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6";

function IconStatCard({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string | number; tone?: "positive" | "negative" | "caution" | "neutral" }) {
  const toneClass = { positive: "bg-success-500/10 text-success-500", negative: "bg-danger-500/10 text-danger-500", caution: "bg-hazard-500/10 text-hazard-500", neutral: "bg-mine-400/10 text-mine-400" }[tone];
  return (
    <div className="bg-mine-950/40 border border-mine-800 rounded-[16px] p-4">
      <div className={`w-8 h-8 rounded-[9px] flex items-center justify-center mb-2.5 ${toneClass}`}>{icon}</div>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-[10px] text-mine-400 mt-1.5 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function SectionCard({ title, icon, anchorRef, children }: { title: string; icon?: React.ReactNode; anchorRef?: React.RefObject<HTMLDivElement>; children: React.ReactNode }) {
  return (
    <div ref={anchorRef} className={cardOuter}>
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-mine-400">{icon}</span>}
        <div className="text-sm font-semibold">{title}</div>
      </div>
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
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const attendanceRef = useRef<HTMLDivElement>(null);
  const certificatesRef = useRef<HTMLDivElement>(null);
  const trainingRef = useRef<HTMLDivElement>(null);
  const medicalRef = useRef<HTMLDivElement>(null);
  const leaveRef = useRef<HTMLDivElement>(null);
  const payslipsRef = useRef<HTMLDivElement>(null);

  function jumpTo(ref: React.RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<WorkerProfile>(`/workers/${worker.id}/profile`);
      setProfile(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
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

  const certPct = profile && profile.stats.totalCertificates > 0 ? Math.round((profile.stats.activeCertificates / profile.stats.totalCertificates) * 100) : null;
  const certColor = certPct == null ? "#5b7092" : certPct >= 80 ? "#16a34a" : certPct >= 50 ? "#c48a1f" : "#e13b2e";
  const ringR = 30;
  const ringCircumference = 2 * Math.PI * ringR;

  const navItems: { label: string; ref: React.RefObject<HTMLDivElement> }[] = [
    { label: t("workers.recentAttendance"), ref: attendanceRef },
    { label: t("workers.certificatesSection"), ref: certificatesRef },
    { label: t("workers.trainingSection"), ref: trainingRef },
    { label: t("workers.medicalHistory"), ref: medicalRef },
    { label: t("workers.leaveSummary"), ref: leaveRef },
    { label: t("workers.payslipsSection"), ref: payslipsRef },
  ];

  return (
    <Modal title={t("workers.profileTitle", { name: worker.name })} onClose={onClose} size="lg">
      <div className="space-y-5">
        {/* Banner + floating avatar */}
        <div>
          <div className="h-16 rounded-t-[20px] bg-mine-800/60" />
          <div className="flex items-end gap-4 px-1 -mt-9">
            <div className="relative shrink-0 rounded-full ring-4 ring-mine-900">
              <Avatar
                size={84}
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
            <div className="pb-1 min-w-0">
              <div className="text-base font-semibold truncate">{worker.name}</div>
              <div className="text-xs text-mine-400">{worker.employeeId} · {worker.role}</div>
              <div className="text-xs text-mine-400">{worker.site?.name}{worker.zone?.name ? ` · ${worker.zone.name}` : ""}</div>
            </div>
            <div className="pb-1 ml-auto flex items-center gap-2 shrink-0">
              {worker.phone && (
                <a
                  href={`tel:${worker.phone}`}
                  className="w-8 h-8 rounded-full bg-mine-800 hover:bg-mine-700 flex items-center justify-center text-hazard-400 transition-colors"
                  aria-label={t("common.phone") ?? ""}
                >
                  <PhoneIcon />
                </a>
              )}
              <StatusBadge status={worker.status} />
            </div>
          </div>
        </div>

        {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
        {loadError && <LoadError onRetry={load} />}

        {!loading && !loadError && profile && (
          <>
            {/* Floating quick-nav */}
            <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-mine-900/95 backdrop-blur border-b border-mine-800 flex gap-1.5 overflow-x-auto">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => jumpTo(item.ref)}
                  className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full bg-mine-800 hover:bg-mine-700 text-mine-300 hover:text-mine-50 transition-colors whitespace-nowrap"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Certification health + stats */}
            <div className={cardOuter}>
              <div className="grid grid-cols-1 md:grid-cols-[100px_1fr] gap-6">
                <div className="flex flex-col items-center text-center shrink-0">
                  {certPct == null ? (
                    <div className="w-[76px] h-[76px] flex items-center justify-center text-mine-400 text-xs">—</div>
                  ) : (
                    <div className="relative w-[76px] h-[76px]">
                      <svg width="76" height="76" viewBox="0 0 76 76">
                        <circle cx="38" cy="38" r={ringR} fill="none" stroke="#eef1f6" strokeWidth="9" />
                        <circle
                          cx="38"
                          cy="38"
                          r={ringR}
                          fill="none"
                          stroke={certColor}
                          strokeWidth="9"
                          strokeLinecap="round"
                          strokeDasharray={ringCircumference}
                          strokeDashoffset={ringCircumference * (1 - certPct / 100)}
                          transform="rotate(-90 38 38)"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">{certPct}%</div>
                    </div>
                  )}
                  <div className="text-[10px] text-mine-400 mt-2 uppercase tracking-wide">{t("workers.activeCerts")}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <IconStatCard icon={<ClockIcon />} label={t("workers.daysWorked90")} value={profile.stats.daysWorkedLast90} />
                  <IconStatCard icon={<RefreshIcon />} label={t("workers.shifts90")} value={profile.stats.shiftsLast90} />
                  <IconStatCard icon={<ClockIcon />} label={t("workers.avgHours")} value={profile.stats.avgHoursPerShift ?? "—"} />
                  <IconStatCard icon={<ShieldCheckIcon />} label={t("workers.activeCerts")} value={`${profile.stats.activeCertificates}/${profile.stats.totalCertificates}`} />
                  <IconStatCard icon={<GraduationCapIcon />} label={t("workers.trainingCompleted")} value={profile.stats.trainingCompleted} />
                  <IconStatCard icon={<HeartPulseIcon />} label={t("workers.lastMedical")} value={profile.stats.latestMedicalResult ? t(`badges.status.${profile.stats.latestMedicalResult}`) : "—"} />
                  <IconStatCard icon={<PalmtreeIcon />} label={t("workers.leaveDaysYear")} value={profile.stats.leaveDaysTakenThisYear} />
                </div>
              </div>
            </div>

            <SectionCard title={t("workers.hoursLast30")}>
              {profile.dailyHoursLast30.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noAttendance")}</div>
              ) : (
                <div className="h-32">
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
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><span className="text-mine-400">{t("common.phone")}:</span> {worker.phone ?? "—"}</div>
                <div><span className="text-mine-400">{t("workers.manager")}:</span> {worker.manager?.name ?? "—"}</div>
                <div><span className="text-mine-400">{t("workers.nextOfKin")}:</span> {worker.nextOfKinName ?? "—"}</div>
                <div><span className="text-mine-400">{t("workers.nextOfKinRelationship")}:</span> {worker.nextOfKinRelationship ?? "—"}</div>
                <div><span className="text-mine-400">{t("workers.nextOfKinPhone")}:</span> {worker.nextOfKinPhone ?? "—"}</div>
              </div>
            </SectionCard>

            <SectionCard title={t("workers.assignedEquipment")}>
              {profile.assignedEquipment.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noAssignedEquipment")}</div>
              ) : (
                <div className="space-y-1.5">
                  {profile.assignedEquipment.map((eq) => (
                    <div key={eq.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5 first:border-t-0 first:pt-0">
                      <span>{eq.name} <span className="text-mine-400">({t(`equipment.types.${eq.type}`)})</span></span>
                      <div className="flex items-center gap-2">
                        <span className="text-mine-400">{eq.site?.name}</span>
                        <StatusBadge status={eq.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.recentAttendance")} anchorRef={attendanceRef}>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {profile.recentAttendance.length === 0 && <div className="text-mine-400 text-xs">{t("workers.noAttendance")}</div>}
                {profile.recentAttendance.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5 first:border-t-0 first:pt-0">
                    <span>{new Date(a.checkInAt).toLocaleString()}</span>
                    <span className="text-mine-400">{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString() : t("workers.stillOnShift")}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title={t("workers.certificatesSection")} anchorRef={certificatesRef}>
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
                          <td className="py-1.5 pr-2">{t(`workforce.cert.types.${c.type}`)}</td>
                          <td className="py-1.5 pr-2 text-mine-300">{c.certificateNumber}</td>
                          <td className="py-1.5 pr-2 text-mine-300">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : "—"}</td>
                          <td className="py-1.5"><StatusBadge status={c.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.trainingSection")} anchorRef={trainingRef}>
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
                          <td className="py-1.5 pr-2">{tr.courseName}</td>
                          <td className="py-1.5 pr-2 text-mine-300">{t(`workforce.training.types.${tr.trainingType}`)}</td>
                          <td className="py-1.5 pr-2 text-mine-300">{new Date(tr.completionDate).toLocaleDateString()}</td>
                          <td className="py-1.5 text-mine-300">{tr.expiryDate ? new Date(tr.expiryDate).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.medicalHistory")} anchorRef={medicalRef}>
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
                          <td className="py-1.5 pr-2">{t(`compliance.medical.examTypes.${m.examType}`)}</td>
                          <td className="py-1.5 pr-2 text-mine-300">{new Date(m.examDate).toLocaleDateString()}</td>
                          <td className="py-1.5 pr-2"><StatusBadge status={m.result} /></td>
                          <td className="py-1.5 text-mine-300">{new Date(m.nextExamDue).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.leaveSummary")} anchorRef={leaveRef}>
              {Object.keys(profile.leaveDaysByType).length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noLeaveThisYear")}</div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                  {Object.entries(profile.leaveDaysByType).map(([type, days]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-mine-400">{t(`payroll.leaveTypes.${type}`)}</span>
                      <span className="font-semibold">{days}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[10px] font-semibold text-mine-400 uppercase mt-3 mb-1.5">{t("workers.recentLeave")}</div>
              {profile.recentLeaveRequests.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noLeaveRequests")}</div>
              ) : (
                <div className="space-y-1.5">
                  {profile.recentLeaveRequests.map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5 first:border-t-0 first:pt-0">
                      <span>{t(`payroll.leaveTypes.${l.leaveType}`)} · {new Date(l.startDate).toLocaleDateString()}–{new Date(l.endDate).toLocaleDateString()}</span>
                      <StatusBadge status={l.status} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("workers.payslipsSection")} anchorRef={payslipsRef}>
              {profile.payslips.length === 0 ? (
                <div className="text-mine-400 text-xs">{t("workers.noPayslips")}</div>
              ) : (
                <div className="space-y-1.5">
                  {profile.payslips.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5 first:border-t-0 first:pt-0">
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
