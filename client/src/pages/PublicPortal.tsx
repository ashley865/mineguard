import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { LogoMark, Wordmark } from "../components/Logo";
import { buttonPrimary, buttonSecondary, cardClass, labelClass, selectClass } from "../components/ui";

interface DirectorySite {
  id: string;
  name: string;
  location: string;
}

interface DirectoryMine {
  id: string;
  name: string;
  sites: DirectorySite[];
}

// Shared by the visitor check-in and contractor registration flows below — both land on a
// per-site page (/visit/:siteId, /contractor-register/:siteId), but someone arriving at
// this general link has no way to already know a siteId, unlike scanning a QR code posted
// at the site itself.
function SitePicker({ mines, onContinue, continueLabel }: {
  mines: DirectoryMine[];
  onContinue: (siteId: string) => void;
  continueLabel: string;
}) {
  const { t } = useTranslation();
  const [mineId, setMineId] = useState("");
  const [siteId, setSiteId] = useState("");
  const sites = mines.find((m) => m.id === mineId)?.sites ?? [];

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelClass}>{t("publicPortal.mine")}</label>
        <select
          className={selectClass}
          value={mineId}
          onChange={(e) => {
            setMineId(e.target.value);
            setSiteId("");
          }}
        >
          <option value="">{t("publicPortal.selectMine")}</option>
          {mines.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.site")}</label>
        <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!mineId}>
          <option value="">{t("publicPortal.selectSite")}</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name} — {s.location}</option>
          ))}
        </select>
      </div>
      <button type="button" className={`${buttonPrimary} w-full`} disabled={!siteId} onClick={() => onContinue(siteId)}>
        {continueLabel}
      </button>
    </div>
  );
}

function PortalCard({ icon, title, description, children }: {
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${cardClass} p-5 space-y-3 flex flex-col`}>
      <div className="text-2xl">{icon}</div>
      <div>
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="text-xs text-mine-400 mt-1">{description}</p>
      </div>
      <div className="mt-auto pt-2">{children}</div>
    </div>
  );
}

export default function PublicPortal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mines, setMines] = useState<DirectoryMine[]>([]);
  const [flow, setFlow] = useState<null | "visit" | "contractor">(null);

  useEffect(() => {
    api.get<DirectoryMine[]>("/public/directory").then((res) => setMines(res.data)).catch(() => setMines([]));
  }, []);

  return (
    <div className="min-h-screen bg-mine-950">
      <div className="border-b border-mine-800 bg-gradient-to-b from-mine-900 to-mine-950 px-6 py-10">
        <div className="max-w-4xl mx-auto text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xl font-bold tracking-tight">
            <LogoMark size={28} />
            <Wordmark />
          </div>
          <p className="text-mine-300 text-sm">{t("publicPortal.subtitle")}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 grid sm:grid-cols-2 gap-4">
        <PortalCard icon="🪪" title={t("publicPortal.visitorTitle")} description={t("publicPortal.visitorDescription")}>
          {flow === "visit" ? (
            <SitePicker mines={mines} continueLabel={t("publicPortal.continueToCheckIn")} onContinue={(siteId) => navigate(`/visit/${siteId}`)} />
          ) : (
            <button type="button" className={`${buttonPrimary} w-full`} onClick={() => setFlow("visit")}>
              {t("publicPortal.startCheckIn")}
            </button>
          )}
        </PortalCard>

        <PortalCard icon="🦺" title={t("publicPortal.contractorTitle")} description={t("publicPortal.contractorDescription")}>
          {flow === "contractor" ? (
            <SitePicker mines={mines} continueLabel={t("publicPortal.continueToRegistration")} onContinue={(siteId) => navigate(`/contractor-register/${siteId}`)} />
          ) : (
            <div className="space-y-2">
              <button type="button" className={`${buttonPrimary} w-full`} onClick={() => setFlow("contractor")}>
                {t("publicPortal.startRegistration")}
              </button>
              <Link to="/contractor-login" className={`${buttonSecondary} w-full text-center block`}>
                {t("publicPortal.contractorLogin")}
              </Link>
            </div>
          )}
        </PortalCard>

        <PortalCard icon="⛏" title={t("publicPortal.buyerTitle")} description={t("publicPortal.buyerDescription")}>
          <div className="space-y-2">
            <Link to="/buy" className={`${buttonPrimary} w-full text-center block`}>{t("publicPortal.browseMarketplace")}</Link>
            <div className="flex gap-2">
              <Link to="/buyer-login" className={`${buttonSecondary} flex-1 text-center`}>{t("marketplace.buyerLogin")}</Link>
              <Link to="/buyer-register" className={`${buttonSecondary} flex-1 text-center`}>{t("marketplace.registerAsBuyer")}</Link>
            </div>
          </div>
        </PortalCard>

        <PortalCard icon="📋" title={t("publicPortal.tenderTitle")} description={t("publicPortal.tenderDescription")}>
          <Link to="/tender-board" className={`${buttonPrimary} w-full text-center block`}>{t("publicPortal.browseTenders")}</Link>
        </PortalCard>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-8 text-center">
        <Link to="/login" className="text-xs text-mine-500 hover:text-mine-300 underline underline-offset-2">
          {t("publicPortal.staffLogin")}
        </Link>
      </div>
    </div>
  );
}
