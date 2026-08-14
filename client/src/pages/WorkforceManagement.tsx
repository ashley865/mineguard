import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Site, Worker } from "../api/types";
import WorkerSafetyTab from "./workforce/WorkerSafetyTab";
import CertificatesTab from "./workforce/CertificatesTab";
import TrainingRecordsTab from "./workforce/TrainingRecordsTab";
import EmployeeComplianceTab from "./workforce/EmployeeComplianceTab";
import ShiftRostering from "./ShiftRostering";
import TrainingLms from "./TrainingLms";
import EmploymentEquityTab from "./workforce/EmploymentEquityTab";
import SkillsDevelopmentTab from "./workforce/SkillsDevelopmentTab";
import RecruitmentTab from "./workforce/RecruitmentTab";
import OnboardingTab from "./workforce/OnboardingTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

type TabKey =
  | "safety"
  | "certificates"
  | "training"
  | "compliance"
  | "roster"
  | "lms"
  | "employmentEquity"
  | "skillsDevelopment"
  | "recruitment"
  | "onboarding";
const TAB_KEYS: TabKey[] = [
  "safety",
  "certificates",
  "training",
  "compliance",
  "roster",
  "lms",
  "employmentEquity",
  "skillsDevelopment",
  "recruitment",
  "onboarding",
];

export default function WorkforceManagement() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab = TAB_KEYS.includes(searchParams.get("tab") as TabKey) ? (searchParams.get("tab") as TabKey) : "safety";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [w, s] = await Promise.all([api.get<Worker[]>("/workers"), api.get<Site[]>("/sites")]);
      setWorkers(w.data);
      setSites(s.data);
      setLoading(false);
    }
    load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "safety", label: t("workforce.tabSafety") },
    { key: "certificates", label: t("workforce.tabCertificates") },
    { key: "training", label: t("workforce.tabTraining") },
    { key: "compliance", label: t("workforce.tabCompliance") },
    { key: "roster", label: t("roster.nav") },
    { key: "lms", label: t("trainingLms.nav") },
    { key: "employmentEquity", label: t("employmentEquity.nav") },
    { key: "skillsDevelopment", label: t("skillsDevelopment.nav") },
    { key: "recruitment", label: t("recruitment.nav") },
    { key: "onboarding", label: t("recruitment.onboarding.nav") },
  ];

  if (loading) return <div className="text-mine-300">{t("workforce.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("workforce.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("workforce.subtitle")}</p>
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

      {tab === "safety" && <WorkerSafetyTab workers={workers} />}
      {tab === "certificates" && <CertificatesTab workers={workers} />}
      {tab === "training" && <TrainingRecordsTab workers={workers} />}
      {tab === "compliance" && <EmployeeComplianceTab workers={workers} />}
      {tab === "roster" && <ShiftRostering />}
      {tab === "lms" && <TrainingLms />}
      {tab === "employmentEquity" && <EmploymentEquityTab />}
      {tab === "skillsDevelopment" && <SkillsDevelopmentTab workers={workers} />}
      {tab === "recruitment" && <RecruitmentTab sites={sites} />}
      {tab === "onboarding" && <OnboardingTab />}
    </div>
  );
}
