import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { cardClass, labelClass, selectClass } from "../components/ui";
import GuardDutyPanel from "../components/patrol/GuardDutyPanel";

interface Guard {
  id: string;
  name: string;
  employeeId: string;
  status: string;
}

function storageKey(siteId: string) {
  return `mineguard_patrol_guard_${siteId}`;
}

export default function PatrolDuty() {
  const { t } = useTranslation();
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<{ id: string; name: string } | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [guardId, setGuardId] = useState<string>("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (guardId && siteId) localStorage.setItem(storageKey(siteId), guardId);
  }, [guardId, siteId]);

  if (loading) return <div className="min-h-screen bg-mine-950 flex items-center justify-center text-mine-300">{t("common.loading")}</div>;

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 p-4">
        <div className={`${cardClass} p-6 max-w-md text-center`}>{t("patrol.duty.siteNotFound")}</div>
      </div>
    );
  }

  const guard = guards.find((g) => g.id === guardId);

  return (
    <div className="min-h-screen bg-mine-950 p-4 flex justify-center">
      <div className="w-full max-w-lg space-y-4">
        <div>
          <div className="text-lg font-bold tracking-tight text-white">⛏ Mine Guard</div>
          <h1 className="text-base font-semibold mt-2 text-mine-50">{t("patrol.duty.title")}</h1>
          {site && <p className="text-mine-300 text-sm">{site.name}</p>}
        </div>

        <div className={`${cardClass} p-4 space-y-3`}>
          <label className={labelClass}>{t("patrol.duty.whoAreYou")}</label>
          <select className={selectClass} value={guardId} onChange={(e) => setGuardId(e.target.value)}>
            <option value="">{t("patrol.duty.selectGuard")}</option>
            {guards.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.employeeId})</option>)}
          </select>
          {guards.length === 0 && <p className="text-xs text-mine-400">{t("patrol.duty.noGuards")}</p>}
        </div>

        {guard && siteId && <GuardDutyPanel siteId={siteId} guardId={guard.id} guardName={guard.name} />}
      </div>
    </div>
  );
}
