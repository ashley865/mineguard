import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Worker } from "../api/types";
import CertificatesTab from "./workforce/CertificatesTab";
import TrainingRecordsTab from "./workforce/TrainingRecordsTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

type TabKey = "certificates" | "training";

export default function WorkforceManagement() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("certificates");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await api.get<Worker[]>("/workers");
      setWorkers(res.data);
      setLoading(false);
    }
    load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "certificates", label: t("workforce.tabCertificates") },
    { key: "training", label: t("workforce.tabTraining") },
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

      {tab === "certificates" && <CertificatesTab workers={workers} />}
      {tab === "training" && <TrainingRecordsTab workers={workers} />}
    </div>
  );
}
