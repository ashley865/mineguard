import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Mine } from "../api/types";

export default function RegisterMine() {
  const { t } = useTranslation();
  const { registerMine } = useAuth();
  const navigate = useNavigate();

  const [mineName, setMineName] = useState("");
  const [location, setLocation] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [miningRightNumber, setMiningRightNumber] = useState("");
  const [description, setDescription] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<{ mine: Mine; passkey: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await registerMine({
        mineName,
        location,
        registrationNumber: registrationNumber || undefined,
        miningRightNumber: miningRightNumber || undefined,
        description: description || undefined,
        adminName,
        adminEmail,
        adminPassword,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error?.formErrors?.[0] ?? err.response?.data?.error ?? t("registerMine.error"));
    } finally {
      setLoading(false);
    }
  }

  function copyPasskey() {
    if (!result) return;
    navigator.clipboard.writeText(result.passkey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function inviteLink() {
    if (!result) return "";
    const params = new URLSearchParams({ mine: result.mine.id, key: result.passkey });
    return `${window.location.origin}/signup?${params.toString()}`;
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-fuchsia-50 px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="text-4xl">⛏</div>
            <div className="text-2xl font-bold tracking-tight mt-1">Mine Guard</div>
            <div className="text-mine-300 text-sm mt-1">{t("registerMine.successTitle")}</div>
          </div>
          <div className="bg-mine-900 border border-mine-800 rounded-xl shadow-xl shadow-black/10 p-6 space-y-4">
            <div className="text-sm">
              {t("registerMine.successBody", { name: result.mine.name })}
            </div>
            <div>
              <label className={labelClass}>{t("registerMine.passkeyLabel")}</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  className={`${inputClass} font-mono text-sm`}
                  value={result.passkey}
                  onFocus={(e) => e.target.select()}
                />
                <button type="button" className={buttonSecondary} onClick={copyPasskey}>
                  {copied ? t("registerMine.copied") : t("registerMine.copy")}
                </button>
              </div>
            </div>
            <div className="text-xs text-danger-400 bg-danger-500/10 border border-danger-500/30 rounded-md p-3">
              {t("registerMine.passkeyWarning")}
            </div>
            <div className="pt-2 border-t border-mine-800">
              <label className={labelClass}>{t("registerMine.inviteLinkLabel")}</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  className={`${inputClass} font-mono text-xs`}
                  value={inviteLink()}
                  onFocus={(e) => e.target.select()}
                />
                <button type="button" className={buttonSecondary} onClick={copyInviteLink}>
                  {linkCopied ? t("registerMine.copied") : t("registerMine.copy")}
                </button>
              </div>
              <div className="text-xs text-mine-400 mt-1">{t("registerMine.inviteLinkHint")}</div>
            </div>
            <button className={`${buttonPrimary} w-full`} onClick={() => navigate("/")}>
              {t("registerMine.continue")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-fuchsia-50 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div className="text-4xl">⛏</div>
          <div className="text-2xl font-bold tracking-tight mt-1">Mine Guard</div>
          <div className="text-mine-300 text-sm mt-1">{t("registerMine.title")}</div>
        </div>
        <form onSubmit={handleSubmit} className="bg-mine-900 border border-mine-800 rounded-xl shadow-xl shadow-black/10 p-6 space-y-4">
          <div className="text-xs font-semibold text-mine-300 uppercase">{t("registerMine.mineDetails")}</div>
          <div>
            <label className={labelClass}>{t("registerMine.mineName")}</label>
            <input className={inputClass} value={mineName} onChange={(e) => setMineName(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t("common.location")}</label>
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("registerMine.registrationNumber")}</label>
              <input className={inputClass} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("registerMine.miningRightNumber")}</label>
              <input className={inputClass} value={miningRightNumber} onChange={(e) => setMiningRightNumber(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("common.description")}</label>
            <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="text-xs font-semibold text-mine-300 uppercase pt-2 border-t border-mine-800">
            {t("registerMine.adminAccount")}
          </div>
          <div>
            <label className={labelClass}>{t("signup.fullName")}</label>
            <input className={inputClass} value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t("signup.email")}</label>
            <input className={inputClass} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t("signup.password")}</label>
            <input
              className={inputClass}
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              minLength={8}
              required
            />
            <div className="text-xs text-mine-400 mt-1">{t("signup.passwordHint")}</div>
          </div>

          {error && <div className="text-danger-400 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className={`${buttonPrimary} w-full`}>
            {loading ? t("registerMine.registering") : t("registerMine.register")}
          </button>
          <div className="text-xs text-mine-400 pt-2 border-t border-mine-800 text-center">
            {t("signup.alreadyHaveAccount")}{" "}
            <Link to="/login" className="text-mine-300 underline hover:text-mine-100">
              {t("signup.signIn")}
            </Link>
            {" · "}
            <Link to="/signup" className="text-mine-300 underline hover:text-mine-100">
              {t("registerMine.joinExisting")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
