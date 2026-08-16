import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ExecutiveAttendanceReport, TeamMember } from "../../api/types";
import Avatar from "../../components/Avatar";
import PasswordConfirmModal from "../../components/PasswordConfirmModal";
import { buttonDanger, cardClass } from "../../components/ui";

function AttendanceReport() {
  const { t } = useTranslation();
  const [report, setReport] = useState<ExecutiveAttendanceReport | null>(null);

  useEffect(() => {
    api.get<ExecutiveAttendanceReport>("/attendance/team", { params: { days: 9 } }).then((res) => setReport(res.data)).catch(() => {});
  }, []);

  if (!report) return null;

  return (
    <div className={`${cardClass} p-4`}>
      <h2 className="text-sm font-semibold mb-1">{t("settings.team.attendanceReportTitle")}</h2>
      <p className="text-xs text-mine-400 mb-3">{t("settings.team.attendanceReportSubtitle")}</p>
      {report.executives.length === 0 ? (
        <div className="text-mine-400 text-xs">{t("settings.team.noExecutives")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-mine-400 uppercase">
              <tr>
                <th className="text-left pr-3 py-1.5">{t("settings.team.executive")}</th>
                <th className="text-left pr-3 py-1.5">{t("settings.team.lastLogin")}</th>
                {report.buckets.map((b) => (
                  <th key={b} className="text-right pr-3 py-1.5">
                    {t("settings.team.periodFrom", { date: new Date(b).toLocaleDateString() })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-mine-800">
              {report.executives.map((exec) => (
                <tr key={exec.userId}>
                  <td className="pr-3 py-1.5 font-medium">
                    {exec.name}
                    <span className="text-mine-400 font-normal">
                      {exec.title ? ` · ${t(`settings.invites.titles.${exec.title}`)}` : ""}
                    </span>
                  </td>
                  <td className="pr-3 py-1.5 text-mine-300">{exec.lastLogin ? new Date(exec.lastLogin).toLocaleString() : "—"}</td>
                  {exec.buckets.map((b) => (
                    <td key={b.periodStart} className="text-right pr-3 py-1.5">
                      <span className={b.logins === 0 ? "text-mine-500" : "text-mine-100 font-semibold"}>{b.hours}h</span>
                      <span className="text-mine-500"> ({b.logins})</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TeamTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

  async function load() {
    const res = await api.get<TeamMember[]>("/auth/team");
    setMembers(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function removeExecutive(password: string) {
    await api.post(`/auth/team/${removeTarget!.id}/remove-executive`, { password });
    setRemoveTarget(null);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("settings.team.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("settings.team.subtitle")}</p>

      {members.length === 0 ? (
        <div className={`${cardClass} p-6 text-center text-mine-300`}>{t("settings.team.noneYet")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => (
            <div key={m.id} className={`${cardClass} p-5 space-y-3`}>
              <div className="flex items-center gap-3">
                <Avatar size={48} name={m.name} src={m.hasPhoto ? `${API_URL}/api/auth/users/${m.id}/photo` : null} />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{m.name}</div>
                  <div className="text-xs text-mine-400 truncate">
                    {m.title ? t(`settings.invites.titles.${m.title}`) : t(`roles.${m.role}`)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-mine-400 truncate">{m.email}</div>
              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-mine-800">
                <div>
                  <div className="text-sm font-semibold">{m.stats.alertsReviewed}</div>
                  <div className="text-[10px] text-mine-400 uppercase tracking-wide">{t("settings.team.alertsReviewed")}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{m.stats.incidentsReviewed}</div>
                  <div className="text-[10px] text-mine-400 uppercase tracking-wide">{t("settings.team.incidentsReviewed")}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{m.stats.messagesSent}</div>
                  <div className="text-[10px] text-mine-400 uppercase tracking-wide">{t("settings.team.messagesSent")}</div>
                </div>
              </div>
              <div className="text-[11px] text-mine-500">
                {t("settings.team.joined")} {new Date(m.createdAt).toLocaleDateString()}
              </div>
              {user?.role === "ADMIN" && m.role === "EXECUTIVE" && (
                <button className={`${buttonDanger} w-full`} onClick={() => setRemoveTarget(m)}>
                  {t("settings.team.removeExecutive")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {user?.role === "ADMIN" && <AttendanceReport />}

      {removeTarget && (
        <PasswordConfirmModal
          title={t("settings.team.removeExecutiveTitle")}
          hint={t("settings.team.removeExecutiveHint", { name: removeTarget.name })}
          confirmLabel={t("settings.team.removeExecutive")}
          onConfirm={removeExecutive}
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
