import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { cardClass } from "../components/ui";
import GuardDutyPanel from "../components/patrol/GuardDutyPanel";
import { LogoMark, Wordmark } from "../components/Logo";

interface Guard {
  id: string;
  name: string;
  employeeId: string;
  siteId: string;
  site: { id: string; name: string };
}

// A guard's personal, secure duty link — resolves the token straight to their own
// identity, so there's no site-wide picker (unlike PatrolDuty.tsx) and no way to act
// as another guard by guessing an id.
export default function PatrolDutyLink() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [guard, setGuard] = useState<Guard | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .get(`/patrol/public/duty-link/${token}`)
      .then((res) => setGuard(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="min-h-screen bg-mine-950 flex items-center justify-center text-mine-300">{t("common.loading")}</div>;

  if (notFound || !guard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 p-4">
        <div className={`${cardClass} p-6 max-w-md text-center`}>{t("patrol.duty.linkInvalid")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mine-950 p-4 flex justify-center">
      <div className="w-full max-w-lg space-y-4">
        <div>
          <div className="text-lg font-bold tracking-tight flex items-center gap-2"><LogoMark size={20} /><Wordmark /></div>
          <h1 className="text-base font-semibold mt-2 text-mine-50">{t("patrol.duty.title")}</h1>
          <p className="text-mine-300 text-sm">{guard.site.name}</p>
        </div>

        <GuardDutyPanel siteId={guard.siteId} guardId={guard.id} guardName={guard.name} />
      </div>
    </div>
  );
}
