import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Site,
  TrainingAttendanceStatus,
  TrainingCourse,
  TrainingEnrollment,
  TrainingSession,
  TrainingSessionStatus,
  TrainingType,
  Worker,
} from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";

const trainingTypes: TrainingType[] = [
  "INDUCTION",
  "REFRESHER",
  "FIRST_AID",
  "FIRE_FIGHTING",
  "SELF_RESCUE",
  "HAZARD_SPECIFIC",
  "SKILLS_DEVELOPMENT",
  "OTHER",
];
const sessionStatuses: TrainingSessionStatus[] = ["SCHEDULED", "COMPLETED", "CANCELLED"];
const attendanceStatuses: TrainingAttendanceStatus[] = ["ENROLLED", "ATTENDED", "NO_SHOW", "COMPLETED"];

function CourseForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseType, setCourseType] = useState<TrainingType>("INDUCTION");
  const [description, setDescription] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [provider, setProvider] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId: siteId || null,
        courseName,
        courseType,
        description: description || undefined,
        durationHours: durationHours ? Number(durationHours) : null,
        provider: provider || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("common.site")}</label>
        <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{t("documents.companyWide")}</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("trainingLms.courseName")}</label>
          <input className={inputClass} value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("workforce.training.trainingType")}</label>
          <select className={selectClass} value={courseType} onChange={(e) => setCourseType(e.target.value as TrainingType)}>
            {trainingTypes.map((tt) => <option key={tt} value={tt}>{t(`workforce.training.types.${tt}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("trainingLms.durationHours")}</label>
          <input className={inputClass} type="number" step="any" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("workforce.training.provider")}</label>
          <input className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function SessionForm({ courses, onSubmit, onCancel }: {
  courses: TrainingCourse[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [scheduledDate, setScheduledDate] = useState("");
  const [location, setLocation] = useState("");
  const [instructor, setInstructor] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ courseId, scheduledDate, location: location || undefined, instructor: instructor || undefined, capacity: capacity ? Number(capacity) : null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("trainingLms.course")}</label>
        <select className={selectClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.courseName}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("trainingLms.scheduledDate")}</label>
        <DateField value={scheduledDate} onChange={setScheduledDate} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("trainingLms.location")}</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("trainingLms.instructor")}</label>
          <input className={inputClass} value={instructor} onChange={(e) => setInstructor(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("trainingLms.capacity")}</label>
        <input className={inputClass} type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function EnrollmentsModal({ session, workers, onClose, onChanged }: {
  session: TrainingSession;
  workers: Worker[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [workerId, setWorkerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<TrainingEnrollment[]>(`/training-lms/sessions/${session.id}/enrollments`);
    setEnrollments(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enrolledIds = new Set(enrollments.map((e) => e.worker.id));
  const availableWorkers = workers.filter((w) => !enrolledIds.has(w.id));

  async function enroll(e: FormEvent) {
    e.preventDefault();
    if (!workerId) return;
    setError(null);
    try {
      await api.post(`/training-lms/sessions/${session.id}/enrollments`, { workerId });
      setWorkerId("");
      await load();
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("trainingLms.enrollError"));
    }
  }

  async function updateStatus(id: string, attendanceStatus: TrainingAttendanceStatus) {
    await api.put(`/training-lms/enrollments/${id}`, { attendanceStatus });
    await load();
    onChanged();
  }

  async function removeEnrollment(id: string) {
    await api.delete(`/training-lms/enrollments/${id}`);
    await load();
    onChanged();
  }

  return (
    <Modal title={t("trainingLms.enrollmentsFor", { name: session.course?.courseName })} onClose={onClose}>
      <div className="space-y-4">
        {availableWorkers.length > 0 && (
          <form onSubmit={enroll} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className={labelClass}>{t("workers.title")}</label>
              <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                <option value="">—</option>
                {availableWorkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <button type="submit" className={buttonPrimary} disabled={!workerId}>{t("trainingLms.enroll")}</button>
          </form>
        )}
        {error && <div className="text-danger-500 text-xs">{error}</div>}

        {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
        {!loading && enrollments.length === 0 && <div className="text-mine-400 text-sm">{t("trainingLms.noEnrollments")}</div>}
        <div className="space-y-1.5">
          {enrollments.map((en) => (
            <div key={en.id} className="flex items-center justify-between text-sm border-t border-mine-800 pt-1.5">
              <span className="font-medium">{en.worker.name}</span>
              <div className="flex items-center gap-2">
                <select
                  className={`${inputClass} text-xs py-1`}
                  value={en.attendanceStatus}
                  onChange={(e) => updateStatus(en.id, e.target.value as TrainingAttendanceStatus)}
                >
                  {attendanceStatuses.map((s) => <option key={s} value={s}>{t(`trainingLms.attendance.${s}`)}</option>)}
                </select>
                <button className={buttonDanger} onClick={() => removeEnrollment(en.id)}>{t("common.delete")}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function CoursesTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<TrainingCourse[]>("/training-lms/courses");
    setCourses(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/training-lms/courses", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("trainingLms.confirmDeleteCourse"))) return;
    await api.delete(`/training-lms/courses/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("trainingLms.newCourse")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("trainingLms.courseName")}</th>
              <th className="text-left px-4 py-2">{t("workforce.training.trainingType")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("workforce.training.provider")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{c.courseName}</td>
                <td className="px-4 py-2 text-mine-300">{t(`workforce.training.types.${c.courseType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{c.site?.name ?? t("documents.companyWide")}</td>
                <td className="px-4 py-2 text-mine-300">{c.provider ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && (
                    <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>
                  )}
                </td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("trainingLms.noneYetCourses")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("trainingLms.newCourseTitle")} onClose={() => setModal(false)}>
          <CourseForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function SessionCompletionBar({ session }: { session: TrainingSession }) {
  const enrollments = session.enrollments ?? [];
  if (enrollments.length === 0) return <span className="text-mine-400 text-xs">—</span>;
  const completed = enrollments.filter((e) => e.attendanceStatus === "COMPLETED" || e.attendanceStatus === "ATTENDED").length;
  const noShow = enrollments.filter((e) => e.attendanceStatus === "NO_SHOW").length;
  const total = enrollments.length;
  const completedPct = (completed / total) * 100;
  const noShowPct = (noShow / total) * 100;
  return (
    <div className="flex items-center gap-1.5 w-24">
      <div className="flex-1 h-1.5 rounded-full bg-mine-800 overflow-hidden flex">
        <div className="h-full bg-success-500" style={{ width: `${completedPct}%` }} />
        <div className="h-full bg-danger-500" style={{ width: `${noShowPct}%` }} />
      </div>
      <span className="text-[10px] text-mine-400 shrink-0">{completed}/{total}</span>
    </div>
  );
}

function SessionsTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [enrollmentsSession, setEnrollmentsSession] = useState<TrainingSession | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TrainingSessionStatus | "ALL">("ALL");

  async function load() {
    setLoading(true);
    const [se, co, wo] = await Promise.all([
      api.get<TrainingSession[]>("/training-lms/sessions", { params: { status: statusFilter, search: search || undefined } }),
      api.get<TrainingCourse[]>("/training-lms/courses"),
      api.get<Worker[]>("/workers"),
    ]);
    setSessions(se.data);
    setCourses(co.data);
    setWorkers(wo.data);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  async function create(data: any) {
    await api.post("/training-lms/sessions", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("trainingLms.confirmDeleteSession"))) return;
    await api.delete(`/training-lms/sessions/${id}`);
    await load();
  }

  async function setStatus(id: string, status: TrainingSessionStatus) {
    await api.put(`/training-lms/sessions/${id}`, { status });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>{t("common.search")}</label>
            <input
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("trainingLms.searchSessions")}
            />
          </div>
          <div>
            <label className={labelClass}>{t("common.status")}</label>
            <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TrainingSessionStatus | "ALL")}>
              <option value="ALL">{t("trainingLms.allStatuses")}</option>
              {sessionStatuses.map((s) => <option key={s} value={s}>{t(`trainingLms.sessionStatus.${s}`)}</option>)}
            </select>
          </div>
        </div>
        {canEdit && courses.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("trainingLms.newSession")}</button>
        )}
      </div>
      {loading ? (
        <div className="text-mine-300">{t("common.loading")}</div>
      ) : (
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("trainingLms.course")}</th>
              <th className="text-left px-4 py-2">{t("trainingLms.scheduledDate")}</th>
              <th className="text-left px-4 py-2">{t("trainingLms.enrolled")}</th>
              <th className="text-left px-4 py-2">{t("trainingLms.completion")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{s.course?.courseName}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(s.scheduledDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{s._count.enrollments}{s.capacity ? ` / ${s.capacity}` : ""}</td>
                <td className="px-4 py-2"><SessionCompletionBar session={s} /></td>
                <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {canEdit && s.status === "SCHEDULED" && (
                      <>
                        <button className="text-xs text-success-500 hover:underline" onClick={() => setStatus(s.id, "COMPLETED")}>{t("trainingLms.markCompleted")}</button>
                        <button className="text-xs text-danger-500 hover:underline" onClick={() => setStatus(s.id, "CANCELLED")}>{t("trainingLms.cancelSession")}</button>
                      </>
                    )}
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setEnrollmentsSession(s)}>{t("trainingLms.manageEnrollments")}</button>
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(s.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("trainingLms.noneYetSessions")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      {modal && (
        <Modal title={t("trainingLms.newSessionTitle")} onClose={() => setModal(false)}>
          <SessionForm courses={courses} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
      {enrollmentsSession && (
        <EnrollmentsModal session={enrollmentsSession} workers={workers} onClose={() => setEnrollmentsSession(null)} onChanged={load} />
      )}
    </div>
  );
}

export default function TrainingLms() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"courses" | "sessions">("courses");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Site[]>("/sites").then((res) => {
      setSites(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button className={tab === "courses" ? buttonPrimary : buttonSecondary} onClick={() => setTab("courses")}>
          {t("trainingLms.tabCourses")}
        </button>
        <button className={tab === "sessions" ? buttonPrimary : buttonSecondary} onClick={() => setTab("sessions")}>
          {t("trainingLms.tabSessions")}
        </button>
      </div>

      {tab === "courses" && <CoursesTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "sessions" && <SessionsTab canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
