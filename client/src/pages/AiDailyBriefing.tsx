import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AiDailyBriefingResponse } from "../api/types";
import { cardClass, buttonSecondary } from "../components/ui";
import LoadError from "../components/LoadError";

export default function AiDailyBriefing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canView = user?.role === "ADMIN" || ["GENERAL_MANAGER", "COO"].includes(user?.title ?? "");
  const [data, setData] = useState<AiDailyBriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<AiDailyBriefingResponse>("/ai/daily-briefing", { params: refresh ? { refresh: "true" } : undefined });
      setData(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canView) return <Navigate to="/" replace />;
  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={() => load()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("aiDailyBriefing.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("aiDailyBriefing.subtitle")}</p>
        </div>
        {data?.configured && (
          <button className={buttonSecondary} disabled={refreshing} onClick={() => load(true)}>
            {refreshing ? t("common.loading") : t("aiDailyBriefing.refresh")}
          </button>
        )}
      </div>

      {!data?.configured && (
        <div className="text-xs font-medium text-mine-300 bg-mine-800/60 border border-mine-700 rounded-md p-3">
          {t("ai.notConfigured")}
        </div>
      )}

      {data?.configured && (
        <>
          <div className="bg-mine-900 border-2 border-hazard-500/40 rounded-xl shadow-lg shadow-hazard-500/10 p-4 bg-gradient-to-br from-hazard-500/5 via-transparent to-transparent">
            <div className="text-sm font-extrabold text-mine-50">{data.headline}</div>
            {data.topPriority && (
              <div className="mt-2 text-xs font-bold text-danger-500">
                {t("aiDailyBriefing.topPriority")}: {data.topPriority}
              </div>
            )}
            {data.generatedAt && (
              <div className="mt-2 text-[10px] text-mine-500">
                {t("aiDailyBriefing.generatedAt", { date: new Date(data.generatedAt).toLocaleString() })}
                {data.cached ? ` · ${t("aiDailyBriefing.cached")}` : ""}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.sections.map((s) => (
              <div key={s.title} className={`${cardClass} p-4`}>
                <h3 className="text-sm font-semibold mb-2">{s.title}</h3>
                <ul className="space-y-1.5">
                  {s.bullets.map((b, i) => (
                    <li key={i} className="text-xs text-mine-200 flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-hazard-500 shrink-0 mt-1" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {data.sections.length === 0 && (
              <div className={`${cardClass} p-6 text-center text-mine-400 md:col-span-2`}>{t("aiDailyBriefing.noneYet")}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
