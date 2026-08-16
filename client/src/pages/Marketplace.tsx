import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Site } from "../api/types";
import MineralListingsTab from "./marketplace/MineralListingsTab";
import BuyersTab from "./marketplace/BuyersTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";
import LoadError from "../components/LoadError";

type TabKey = "minerals" | "buyers";

export default function Marketplace() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("minerals");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    api
      .get<Site[]>("/sites")
      .then((res) => setSites(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "minerals", label: t("marketplace.tabMinerals") },
    { key: "buyers", label: t("marketplace.tabBuyers") },
  ];

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("marketplace.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("marketplace.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button key={tb.key} className={tab === tb.key ? buttonPrimary : buttonSecondary} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "minerals" && <MineralListingsTab sites={sites} />}
      {tab === "buyers" && <BuyersTab />}
    </div>
  );
}
