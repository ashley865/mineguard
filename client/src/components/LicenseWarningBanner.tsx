import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

// Non-blocking: this only ever renders while the account can still log in (see
// checkMineLicense in server/src/lib/licensing.ts — a warning and a hard block are mutually
// exclusive outcomes of the same check), so it's a heads-up for whoever can fix the billing
// relationship, not an urgent operational alert like the evacuation siren bar above it.
export default function LicenseWarningBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const warning = user?.licenseWarning;
  if (!warning) return null;

  return (
    <div className="shrink-0 bg-hazard-500/10 border-b border-hazard-500/40 px-4 md:px-6 lg:px-8 py-1.5 text-[11px] sm:text-xs text-hazard-600 font-semibold flex items-center gap-2 print:hidden">
      <span aria-hidden>⚠️</span>
      <span>{t(`license.warning.${warning.code}`, { count: warning.days })}</span>
    </div>
  );
}
