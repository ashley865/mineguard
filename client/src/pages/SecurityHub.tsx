import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Site, Zone } from "../api/types";
import CctvTab from "./security/CctvTab";
import IncidentManagementTab from "./security/IncidentManagementTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

type TabKey = "cctv" | "incidents";

export default function SecurityHub() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("cctv");
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [s, z] = await Promise.all([api.get<Site[]>("/sites"), api.get<Zone[]>("/zones")]);
      setSites(s.data);
      setZones(z.data);
      setLoading(false);
    }
    load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "cctv", label: t("security.tabCctv") },
    { key: "incidents", label: t("security.tabIncidents") },
  ];

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("security.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("security.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
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

      {tab === "cctv" && <CctvTab sites={sites} zones={zones} />}
      {tab === "incidents" && <IncidentManagementTab sites={sites} zones={zones} />}
    </div>
  );
}
