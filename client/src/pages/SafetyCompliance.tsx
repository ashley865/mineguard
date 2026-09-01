import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Site, Worker, Zone } from "../api/types";
import HazardManagementTab from "./compliance/HazardManagementTab";
import CodesOfPracticeTab from "./compliance/CodesOfPracticeTab";
import RiskAssessmentsTab from "./compliance/RiskAssessmentsTab";
import RegulatoryNoticesTab from "./compliance/RegulatoryNoticesTab";
import RequirementsRegisterTab from "./compliance/RequirementsRegisterTab";
import AuditFindingsTab from "./compliance/AuditFindingsTab";
import MedicalSurveillanceTab from "./compliance/MedicalSurveillanceTab";
import SafetyInspectionsTab from "./compliance/SafetyInspectionsTab";
import ExplosivesRegister from "./ExplosivesRegister";
import StatutoryAppointmentsTab from "./compliance/StatutoryAppointmentsTab";
import IodClaimsTab from "./compliance/IodClaimsTab";
import BlastLogsTab from "./compliance/BlastLogsTab";
import TailingsTab from "./compliance/TailingsTab";
import ClosureRehabilitationTab from "./compliance/ClosureRehabilitationTab";
import LegalComplianceTab from "./compliance/LegalComplianceTab";
import LandManagementTab from "./compliance/LandManagementTab";
import FatigueManagementTab from "./compliance/FatigueManagementTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

type TabKey =
  | "hazards"
  | "cop"
  | "risk"
  | "notices"
  | "requirements"
  | "audit"
  | "medical"
  | "inspections"
  | "explosives"
  | "appointments"
  | "iodClaims"
  | "blastLogs"
  | "tailings"
  | "closure"
  | "legal"
  | "land"
  | "fatigue";
const TAB_KEYS: TabKey[] = [
  "hazards",
  "cop",
  "risk",
  "notices",
  "requirements",
  "audit",
  "medical",
  "inspections",
  "explosives",
  "appointments",
  "iodClaims",
  "blastLogs",
  "tailings",
  "closure",
  "legal",
  "land",
  "fatigue",
];

export default function SafetyCompliance() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab = TAB_KEYS.includes(searchParams.get("tab") as TabKey) ? (searchParams.get("tab") as TabKey) : "hazards";
  const [tab, setTab] = useState<TabKey>(initialTab);
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
    { key: "hazards", label: t("compliance.tabHazards") },
    { key: "cop", label: t("compliance.tabCop") },
    { key: "risk", label: t("compliance.tabRisk") },
    { key: "notices", label: t("compliance.tabNotices") },
    { key: "requirements", label: t("compliance.tabRequirements") },
    { key: "audit", label: t("compliance.tabAudit") },
    { key: "medical", label: t("compliance.tabMedical") },
    { key: "inspections", label: t("compliance.tabInspections") },
    { key: "explosives", label: t("explosives.nav") },
    { key: "appointments", label: t("statutoryAppointments.nav") },
    { key: "iodClaims", label: t("iodClaims.nav") },
    { key: "blastLogs", label: t("blastLogs.nav") },
    { key: "tailings", label: t("tailings.nav") },
    { key: "closure", label: t("closureRehabilitation.nav") },
    { key: "legal", label: t("legalCompliance.nav") },
    { key: "land", label: t("landManagement.nav") },
    { key: "fatigue", label: t("fatigueManagement.nav") },
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

      {tab === "hazards" && <HazardManagementTab sites={sites} zones={zones} />}
      {tab === "cop" && <CodesOfPracticeTab sites={sites} zones={zones} />}
      {tab === "risk" && <RiskAssessmentsTab sites={sites} zones={zones} />}
      {tab === "notices" && <RegulatoryNoticesTab sites={sites} zones={zones} />}
      {tab === "requirements" && <RequirementsRegisterTab sites={sites} />}
      {tab === "audit" && <AuditFindingsTab sites={sites} />}
      {tab === "medical" && <MedicalSurveillanceTab workers={workers} />}
      {tab === "inspections" && <SafetyInspectionsTab sites={sites} zones={zones} />}
      {tab === "explosives" && <ExplosivesRegister />}
      {tab === "appointments" && <StatutoryAppointmentsTab sites={sites} workers={workers} />}
      {tab === "iodClaims" && <IodClaimsTab workers={workers} />}
      {tab === "blastLogs" && <BlastLogsTab sites={sites} zones={zones} workers={workers} />}
      {tab === "tailings" && <TailingsTab sites={sites} />}
      {tab === "closure" && <ClosureRehabilitationTab sites={sites} />}
      {tab === "legal" && <LegalComplianceTab sites={sites} />}
      {tab === "land" && <LandManagementTab sites={sites} />}
      {tab === "fatigue" && <FatigueManagementTab workers={workers} />}
    </div>
  );
}
