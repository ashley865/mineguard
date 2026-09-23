import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { LogoMark, Wordmark } from "../components/Logo";
import { buttonPrimary, buttonSecondary, cardClass, labelClass, selectClass } from "../components/ui";
import { IdCardIcon, UsersIcon, GemIcon, ClipboardIcon } from "../components/icons/DashboardIcons";

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
    <div className="space-y-2.5 rounded-lg border border-mine-800 bg-mine-950/60 p-3">
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
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${cardClass} p-5 space-y-3 flex flex-col hover:border-hazard-500/40 hover:-translate-y-0.5 transition-all duration-200`}
    >
      <div className="w-11 h-11 rounded-xl bg-hazard-500/10 text-hazard-400 flex items-center justify-center">{icon}</div>
      <div>
        <h2 className="text-sm font-bold text-mine-50">{title}</h2>
        <p className="text-xs text-mine-400 mt-1 leading-relaxed">{description}</p>
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
      <div className="relative overflow-hidden border-b border-mine-800 bg-gradient-to-b from-mine-900 to-mine-950 px-6 py-14">
        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-hazard-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-success-500/10 blur-3xl" />
        <div className="relative max-w-4xl mx-auto text-center space-y-3">
          <div className="flex items-center justify-center gap-2.5">
            <LogoMark size={34} />
            <Wordmark />
          </div>
          <p className="text-mine-300 text-sm max-w-md mx-auto text-balance">{t("publicPortal.subtitle")}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 grid sm:grid-cols-2 gap-4">
        <PortalCard icon={<IdCardIcon />} title={t("publicPortal.visitorTitle")} description={t("publicPortal.visitorDescription")}>
          {flow === "visit" ? (
            <SitePicker mines={mines} continueLabel={t("publicPortal.continueToCheckIn")} onContinue={(siteId) => navigate(`/visit/${siteId}`)} />
          ) : (
            <button type="button" className={`${buttonPrimary} w-full`} onClick={() => setFlow("visit")}>
              {t("publicPortal.startCheckIn")}
            </button>
          )}
        </PortalCard>

        <PortalCard icon={<UsersIcon />} title={t("publicPortal.contractorTitle")} description={t("publicPortal.contractorDescription")}>
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

        <PortalCard icon={<GemIcon />} title={t("publicPortal.buyerTitle")} description={t("publicPortal.buyerDescription")}>
          <div className="space-y-2">
            <Link to="/buy" className={`${buttonPrimary} w-full text-center block`}>{t("publicPortal.browseMarketplace")}</Link>
            <div className="flex gap-2">
              <Link to="/buyer-login" className={`${buttonSecondary} flex-1 text-center`}>{t("marketplace.buyerLogin")}</Link>
              <Link to="/buyer-register" className={`${buttonSecondary} flex-1 text-center`}>{t("marketplace.registerAsBuyer")}</Link>
            </div>
          </div>
        </PortalCard>

        <PortalCard icon={<ClipboardIcon />} title={t("publicPortal.tenderTitle")} description={t("publicPortal.tenderDescription")}>
          <Link to="/tender-board" className={`${buttonPrimary} w-full text-center block`}>{t("publicPortal.browseTenders")}</Link>
        </PortalCard>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-10 pt-2 text-center border-t border-mine-800/60 mt-2">
        <Link to="/login" className="inline-block mt-6 text-xs text-mine-500 hover:text-mine-300 underline underline-offset-2">
          {t("publicPortal.staffLogin")}
        </Link>
      </div>
    </div>
  );
}
