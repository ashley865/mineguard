import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Equipment, Site, Zone } from "../api/types";
import LiftingRegisterTab from "./plant/LiftingRegisterTab";
import PressureRegisterTab from "./plant/PressureRegisterTab";
import ElectricalComplianceTab from "./plant/ElectricalComplianceTab";
import AssetReliabilityTab from "./plant/AssetReliabilityTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

// The engineering appointee's plant-integrity home. Three statutory registers the
// mine must be able to produce on demand — lifting tackle, pressure equipment and
// electrical/Ex apparatus — plus the reliability data that turns "we need to spend
// money on this" into an argument with numbers behind it.

type TabKey = "lifting" | "pressure" | "electrical" | "reliability";
const TAB_KEYS: TabKey[] = ["lifting", "pressure", "electrical", "reliability"];

export default function PlantIntegrity() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab = TAB_KEYS.includes(searchParams.get("tab") as TabKey) ? (searchParams.get("tab") as TabKey) : "lifting";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [s, z, e] = await Promise.all([
        api.get<Site[]>("/sites"),
        api.get<Zone[]>("/zones"),
        api.get<Equipment[]>("/equipment"),
      ]);
      setSites(s.data);
      setZones(z.data);
      setEquipment(e.data);
      setLoading(false);
    }
    load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "lifting", label: t("plantIntegrity.lifting.nav") },
    { key: "pressure", label: t("plantIntegrity.pressure.nav") },
    { key: "electrical", label: t("plantIntegrity.electrical.nav") },
    { key: "reliability", label: t("plantIntegrity.reliability.nav") },
  ];

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("plantIntegrity.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("plantIntegrity.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button key={tb.key} className={tab === tb.key ? buttonPrimary : buttonSecondary} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "lifting" && <LiftingRegisterTab sites={sites} />}
      {tab === "pressure" && <PressureRegisterTab sites={sites} />}
      {tab === "electrical" && <ElectricalComplianceTab sites={sites} zones={zones} />}
      {tab === "reliability" && <AssetReliabilityTab equipment={equipment} />}
    </div>
  );
}
