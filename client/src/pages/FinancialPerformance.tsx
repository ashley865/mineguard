import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Site } from "../api/types";
import FinancialPerformanceTab from "./production/FinancialPerformanceTab";
import LoadError from "../components/LoadError";

export default function FinancialPerformance() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canView = user?.role === "ADMIN" || ["GENERAL_MANAGER", "CFO", "COO"].includes(user?.title ?? "");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<Site[]>("/sites");
      setSites(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canView) return <Navigate to="/" replace />;
  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("financial.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("financial.subtitle")}</p>
      </div>
      <FinancialPerformanceTab sites={sites} />
    </div>
  );
}
