import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { buttonPrimary, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";

interface InviteInfo {
  name: string;
  email: string;
  mine: { id: string; name: string };
}

export default function AcceptExecutiveInvite() {
  const { t } = useTranslation();
  const { user, acceptExecutiveInvite } = useAuth();
  const navigate = useNavigate();
  const { inviteId } = useParams<{ inviteId: string }>();
  const [searchParams] = useSearchParams();
  const key = searchParams.get("key") ?? "";

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    api
      .get<InviteInfo>(`/executive-invites/${inviteId}/info`)
      .then((res) => setInvite(res.data))
      .catch(() => setNotFound(true));
  }, [inviteId]);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inviteId) return;
    setError(null);
    setLoading(true);
    try {
      await acceptExecutiveInvite(inviteId, key, password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error?.formErrors?.[0] ?? err.response?.data?.error ?? t("acceptInvite.error"));
    } finally {
      setLoading(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-fuchsia-50 px-4">
        <div className="bg-mine-900 border border-mine-800 rounded-xl shadow-xl shadow-black/10 p-6 max-w-sm text-center text-mine-300">
          {t("acceptInvite.invalid")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-fuchsia-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div className="text-4xl">⛏</div>
          <div className="text-2xl font-bold tracking-tight mt-1">Mine Guard</div>
          <div className="text-mine-300 text-sm mt-1">{t("acceptInvite.title")}</div>
        </div>
        <form onSubmit={handleSubmit} className="bg-mine-900 border border-mine-800 rounded-xl shadow-xl shadow-black/10 p-6 space-y-4">
          {invite && (
            <div className="bg-mine-800/40 border border-mine-800 rounded-md p-3 text-sm">
              <div className="font-medium">{invite.name}</div>
              <div className="text-xs text-mine-400">{invite.email}</div>
              <div className="text-xs text-mine-400 mt-1">{t("acceptInvite.joiningMine", { mine: invite.mine.name })}</div>
            </div>
          )}
          <div>
            <label className={labelClass}>{t("signup.password")}</label>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <div className="text-xs text-mine-400 mt-1">{t("signup.passwordHint")}</div>
          </div>
          {error && <div className="text-danger-400 text-sm">{error}</div>}
          <button type="submit" disabled={loading || !invite} className={`${buttonPrimary} w-full`}>
            {loading ? t("acceptInvite.joining") : t("acceptInvite.join")}
          </button>
        </form>
      </div>
    </div>
  );
}
