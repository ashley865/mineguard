import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Site } from "../api/types";
import WasteManagementTab from "./environmental/WasteManagementTab";
import EmissionComplianceTab from "./environmental/EmissionComplianceTab";
import GroundwaterMonitoringTab from "./environmental/GroundwaterMonitoringTab";
import EnvironmentalIncidentsTab from "./environmental/EnvironmentalIncidentsTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

// The environmental control officer's statutory-register home. Three registers
// the mine must be able to produce on demand — waste manifests, the AEL and dust
// network, and the groundwater monitoring boreholes — plus the incident register
// that turns spill and non-conformance data into an accountability trail:
// recurrence by source, notification timeliness, and remediation verification.

type TabKey = "waste" | "emissions" | "groundwater" | "incidents";
const TAB_KEYS: TabKey[] = ["waste", "emissions", "groundwater", "incidents"];

export default function EnvironmentalRegisters() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab = TAB_KEYS.includes(searchParams.get("tab") as TabKey) ? (searchParams.get("tab") as TabKey) : "waste";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const s = await api.get<Site[]>("/sites");
      setSites(s.data);
      setLoading(false);
    }
    load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "waste", label: t("environmentalRegisters.waste.nav") },
    { key: "emissions", label: t("environmentalRegisters.emissions.nav") },
    { key: "groundwater", label: t("environmentalRegisters.groundwater.nav") },
    { key: "incidents", label: t("environmentalRegisters.incidents.nav") },
  ];

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("environmentalRegisters.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("environmentalRegisters.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button key={tb.key} className={tab === tb.key ? buttonPrimary : buttonSecondary} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "waste" && <WasteManagementTab sites={sites} />}
      {tab === "emissions" && <EmissionComplianceTab sites={sites} />}
      {tab === "groundwater" && <GroundwaterMonitoringTab sites={sites} />}
      {tab === "incidents" && <EnvironmentalIncidentsTab sites={sites} />}
    </div>
  );
}
