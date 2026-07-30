import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { buttonPrimary, cardClass, inputClass, labelClass } from "../../components/ui";

export default function ProfileTab() {
  const { t } = useTranslation();
  const { user, updateProfile, changePassword } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      await updateProfile(name);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err: any) {
      setProfileError(err.response?.data?.error ?? t("settings.profile.saveError"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.profile.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error ?? t("settings.profile.passwordError"));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <form onSubmit={saveProfile} className={`${cardClass} p-5 space-y-4`}>
        <h2 className="text-sm font-semibold">{t("settings.profile.title")}</h2>
        <div>
          <label className={labelClass}>{t("settings.profile.name")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("settings.profile.email")}</label>
          <input className={inputClass} value={user?.email ?? ""} readOnly disabled />
        </div>
        <div>
          <label className={labelClass}>{t("common.role")}</label>
          <input className={inputClass} value={user?.role ?? ""} readOnly disabled />
        </div>
        {profileError && <div className="text-danger-500 text-xs">{profileError}</div>}
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonPrimary} disabled={savingProfile}>
            {savingProfile ? t("common.saving") : t("common.save")}
          </button>
          {profileSaved && <span className="text-xs text-emerald-500">{t("settings.profile.saved")}</span>}
        </div>
      </form>

      <form onSubmit={savePassword} className={`${cardClass} p-5 space-y-4`}>
        <h2 className="text-sm font-semibold">{t("settings.profile.passwordTitle")}</h2>
        <div>
          <label className={labelClass}>{t("settings.profile.currentPassword")}</label>
          <input
            className={inputClass}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass}>{t("settings.profile.newPassword")}</label>
          <input
            className={inputClass}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div>
          <label className={labelClass}>{t("settings.profile.confirmPassword")}</label>
          <input
            className={inputClass}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        {passwordError && <div className="text-danger-500 text-xs">{passwordError}</div>}
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonPrimary} disabled={savingPassword}>
            {savingPassword ? t("common.saving") : t("settings.profile.updatePassword")}
          </button>
          {passwordSaved && <span className="text-xs text-emerald-500">{t("settings.profile.saved")}</span>}
        </div>
      </form>
    </div>
  );
}
