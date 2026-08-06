import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Site, Worker, Zone } from "../api/types";
import CodesOfPracticeTab from "./compliance/CodesOfPracticeTab";
import RiskAssessmentsTab from "./compliance/RiskAssessmentsTab";
import RegulatoryNoticesTab from "./compliance/RegulatoryNoticesTab";
import RequirementsRegisterTab from "./compliance/RequirementsRegisterTab";
import MedicalSurveillanceTab from "./compliance/MedicalSurveillanceTab";
import SafetyInspectionsTab from "./compliance/SafetyInspectionsTab";
import ExplosivesRegister from "./ExplosivesRegister";
import { buttonPrimary, buttonSecondary } from "../components/ui";

type TabKey = "cop" | "risk" | "notices" | "requirements" | "medical" | "inspections" | "explosives";

export default function SafetyCompliance() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("cop");
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [s, z, w] = await Promise.all([
        api.get<Site[]>("/sites"),
        api.get<Zone[]>("/zones"),
        api.get<Worker[]>("/workers"),
      ]);
      setSites(s.data);
      setZones(z.data);
      setWorkers(w.data);
      setLoading(false);
    }
    load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "cop", label: t("compliance.tabCop") },
    { key: "risk", label: t("compliance.tabRisk") },
    { key: "notices", label: t("compliance.tabNotices") },
    { key: "requirements", label: t("compliance.tabRequirements") },
    { key: "medical", label: t("compliance.tabMedical") },
    { key: "inspections", label: t("compliance.tabInspections") },
    { key: "explosives", label: t("explosives.nav") },
  ];

  if (loading) return <div className="text-mine-300">{t("compliance.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("compliance.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("compliance.subtitle")}</p>
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

      {tab === "cop" && <CodesOfPracticeTab sites={sites} zones={zones} />}
      {tab === "risk" && <RiskAssessmentsTab sites={sites} zones={zones} />}
      {tab === "notices" && <RegulatoryNoticesTab sites={sites} zones={zones} />}
      {tab === "requirements" && <RequirementsRegisterTab sites={sites} />}
      {tab === "medical" && <MedicalSurveillanceTab workers={workers} />}
      {tab === "inspections" && <SafetyInspectionsTab sites={sites} zones={zones} />}
      {tab === "explosives" && <ExplosivesRegister />}
    </div>
  );
}
