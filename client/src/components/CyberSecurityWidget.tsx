import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { CyberDashboard } from "../api/types";
import { cardClass } from "./ui";

// A condensed cross-link into Cyber Command Center's much richer scoring engine — reused
// as-is (GET /cyber-dashboard) rather than duplicated, so the Owner and IT Manager
// dashboards always agree with the number Cyber Command Center itself shows. Silently
// renders nothing if the caller isn't cyber-privileged (403) rather than erroring, since
// that's a normal, expected outcome for some viewers of a shared dashboard component.
export default function CyberSecurityWidget() {
  const { t } = useTranslation();
  const [data, setData] = useState<CyberDashboard | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    api
      .get<CyberDashboard>("/cyber-dashboard")
      .then((res) => setData(res.data))
      .catch(() => setDenied(true));
  }, []);

  if (denied || !data) return null;

  const tone = data.score >= 80 ? "text-success-500" : data.score >= 50 ? "text-hazard-500" : "text-danger-500";
  const trendArrow = data.trendDirection === "up" ? "↑" : data.trendDirection === "down" ? "↓" : "→";

  return (
    <Link to="/cyber-command-center" className={`${cardClass} p-3 flex items-center justify-between gap-3 hover:border-mine-600 transition-colors block`}>
      <div>
        <h2 className="text-xs font-semibold">{t("dashboard.cyberSecurityScore")}</h2>
        <p className="text-[10px] text-mine-400 mt-0.5">
          {data.activeThreats.criticalCount > 0
            ? t("dashboard.cyberCriticalThreats", { count: data.activeThreats.criticalCount })
            : t("dashboard.cyberNoCriticalThreats")}
        </p>
      </div>
      <div className={`text-xl font-bold ${tone} flex items-center gap-1`}>
        {data.score}%<span className="text-xs">{trendArrow}</span>
      </div>
    </Link>
  );
}
