import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { TeamMember } from "../../api/types";
import Avatar from "../../components/Avatar";
import { cardClass } from "../../components/ui";

export default function TeamTab() {
  const { t } = useTranslation();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TeamMember[]>("/auth/team")
      .then((res) => setMembers(res.data))
      .finally(() => setLoading(false));
  }, []);

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
                    {m.title ? t(`settings.invites.titles.${m.title}`) : m.role}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
