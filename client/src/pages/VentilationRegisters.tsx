import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Site, Zone } from "../api/types";
import FanRegisterTab from "./ventilationRegisters/FanRegisterTab";
import GasInstrumentsTab from "./ventilationRegisters/GasInstrumentsTab";
import ThermalStressTab from "./ventilationRegisters/ThermalStressTab";
import EscapeReadinessTab from "./ventilationRegisters/EscapeReadinessTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

// The ventilation officer and occupational hygienist's register home. Airflow
// districts and exposure sampling already live in /ventilation; these are the
// four obligations sitting either side of them — the fans that move the air,
// the instruments that prove what was measured, the heat the air has to carry
// away, and whether people could actually get out.

type TabKey = "fans" | "instruments" | "thermal" | "escape";
const TAB_KEYS: TabKey[] = ["fans", "instruments", "thermal", "escape"];

export default function VentilationRegisters() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab = TAB_KEYS.includes(searchParams.get("tab") as TabKey) ? (searchParams.get("tab") as TabKey) : "fans";
  const [tab, setTab] = useState<TabKey>(initialTab);
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
    { key: "fans", label: t("ventilationRegisters.fans.nav") },
    { key: "instruments", label: t("ventilationRegisters.instruments.nav") },
    { key: "thermal", label: t("ventilationRegisters.thermal.nav") },
    { key: "escape", label: t("ventilationRegisters.escape.nav") },
  ];

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("ventilationRegisters.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("ventilationRegisters.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button key={tb.key} className={tab === tb.key ? buttonPrimary : buttonSecondary} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "fans" && <FanRegisterTab sites={sites} zones={zones} />}
      {tab === "instruments" && <GasInstrumentsTab sites={sites} />}
      {tab === "thermal" && <ThermalStressTab sites={sites} zones={zones} />}
      {tab === "escape" && <EscapeReadinessTab sites={sites} />}
    </div>
  );
}
