import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { DrillHole, Site } from "../api/types";
import MineSurveyTab from "./resourceGovernance/MineSurveyTab";
import QaqcTab from "./resourceGovernance/QaqcTab";
import MineralRightsTab from "./resourceGovernance/MineralRightsTab";
import GradeReconciliationTab from "./resourceGovernance/GradeReconciliationTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

// The mineral resources manager's statutory-register home. Survey/boundary
// compliance, the mineral rights themselves, and the QAQC program are three
// obligations the mine must be able to produce on demand; grade reconciliation
// is what turns the resource model — and everything reported off it — into a
// number the mine can defend.

type TabKey = "survey" | "qaqc" | "rights" | "reconciliation";
const TAB_KEYS: TabKey[] = ["survey", "qaqc", "rights", "reconciliation"];

export default function ResourceGovernance() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab = TAB_KEYS.includes(searchParams.get("tab") as TabKey) ? (searchParams.get("tab") as TabKey) : "survey";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [sites, setSites] = useState<Site[]>([]);
  const [drillHoles, setDrillHoles] = useState<DrillHole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [s, d] = await Promise.all([
        api.get<Site[]>("/sites"),
        api.get<DrillHole[]>("/geology/drill-holes"),
      ]);
      setSites(s.data);
      setDrillHoles(d.data);
      setLoading(false);
    }
    load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "survey", label: t("resourceGovernance.survey.nav") },
    { key: "qaqc", label: t("resourceGovernance.qaqc.nav") },
    { key: "rights", label: t("resourceGovernance.rights.nav") },
    { key: "reconciliation", label: t("resourceGovernance.reconciliation.nav") },
  ];

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("resourceGovernance.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("resourceGovernance.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button key={tb.key} className={tab === tb.key ? buttonPrimary : buttonSecondary} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "survey" && <MineSurveyTab sites={sites} />}
      {tab === "qaqc" && <QaqcTab sites={sites} drillHoles={drillHoles} />}
      {tab === "rights" && <MineralRightsTab sites={sites} />}
      {tab === "reconciliation" && <GradeReconciliationTab sites={sites} />}
    </div>
  );
}
