import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Site } from "../api/types";
import VisitLogTab from "./inspection/VisitLogTab";
import SnapshotTab from "./inspection/SnapshotTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

type TabKey = "visits" | "snapshot";

export default function GovernmentInspection() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("visits");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await api.get<Site[]>("/sites");
      setSites(res.data);
      setLoading(false);
    }
    load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "visits", label: t("inspection.tabVisits") },
    { key: "snapshot", label: t("inspection.tabSnapshot") },
  ];

  if (loading) return <div className="text-mine-300">{t("inspection.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("inspection.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("inspection.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap print:hidden">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            className={tab === tb.key ? buttonPrimary : buttonSecondary}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "visits" && <VisitLogTab sites={sites} />}
      {tab === "snapshot" && <SnapshotTab sites={sites} />}
    </div>
  );
}
