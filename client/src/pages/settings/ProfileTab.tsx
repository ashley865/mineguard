import { FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { api, API_URL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../../components/Avatar";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass } from "../../components/ui";
import { ShieldCheckIcon, ShieldOffIcon } from "../../components/icons/DashboardIcons";

const cardOuter = "bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6";

function MfaCard() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string; qrDataUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [showDisableForm, setShowDisableForm] = useState(false);

  async function startSetup() {
    setStarting(true);
    setVerifyError(null);
    try {
      const res = await api.post<{ secret: string; otpauthUrl: string }>("/auth/mfa/setup");
      const qrDataUrl = await QRCode.toDataURL(res.data.otpauthUrl, { width: 200, margin: 1 });
      setSetupData({ ...res.data, qrDataUrl });
    } finally {
      setStarting(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);
    try {
      await api.post("/auth/mfa/verify", { token: verifyCode });
      setSetupData(null);
      setVerifyCode("");
      await refreshUser();
    } catch (err: any) {
      setVerifyError(err.response?.data?.error ?? t("settings.profile.mfaVerifyError"));
    } finally {
      setVerifying(false);
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    setDisabling(true);
    setDisableError(null);
    try {
      await api.post("/auth/mfa/disable", { password: disablePassword });
      setDisablePassword("");
      setShowDisableForm(false);
      await refreshUser();
    } catch (err: any) {
      setDisableError(err.response?.data?.error ?? t("settings.profile.mfaDisableError"));
    } finally {
      setDisabling(false);
    }
  }

  return (
    <div className={`${cardOuter} space-y-4`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${user?.mfaEnabled ? "bg-success-500/10 text-success-500" : "bg-hazard-500/10 text-hazard-500"}`}>
          {user?.mfaEnabled ? <ShieldCheckIcon /> : <ShieldOffIcon />}
        </div>
        <div>
          <h2 className="text-sm font-semibold">{t("settings.profile.mfaTitle")}</h2>
          <p className="text-xs text-mine-400 mt-0.5">{t("settings.profile.mfaHint")}</p>
        </div>
      </div>

      {user?.mfaEnabled ? (
        <div className="space-y-3">
          <div className="text-xs text-success-500 font-semibold">{t("settings.profile.mfaEnabledStatus")}</div>
          {!showDisableForm ? (
            <button type="button" className={buttonDanger} onClick={() => setShowDisableForm(true)}>
              {t("settings.profile.mfaDisable")}
            </button>
          ) : (
            <form onSubmit={disable} className="space-y-2">
              <label className={labelClass}>{t("settings.profile.currentPassword")}</label>
              <input
                className={inputClass}
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                autoFocus
              />
              {disableError && <div className="text-danger-500 text-xs">{disableError}</div>}
              <div className="flex gap-2">
                <button type="button" className={buttonSecondary} onClick={() => { setShowDisableForm(false); setDisableError(null); }}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className={buttonDanger} disabled={disabling}>
                  {disabling ? t("common.saving") : t("settings.profile.mfaConfirmDisable")}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : setupData ? (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-xs text-mine-300">{t("settings.profile.mfaScanHint")}</p>
          <img src={setupData.qrDataUrl} alt="MFA QR code" className="rounded-md border border-mine-800" width={200} height={200} />
          <div>
            <div className="text-[11px] text-mine-400 mb-1">{t("settings.profile.mfaManualEntry")}</div>
            <code className="text-xs text-mine-200 bg-mine-800/60 rounded px-2 py-1 break-all">{setupData.secret}</code>
          </div>
          <div>
            <label className={labelClass}>{t("settings.profile.mfaEnterCode")}</label>
            <input
              className={inputClass}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="000000"
              required
            />
          </div>
          {verifyError && <div className="text-danger-500 text-xs">{verifyError}</div>}
          <div className="flex gap-2">
            <button type="button" className={buttonSecondary} onClick={() => setSetupData(null)}>{t("common.cancel")}</button>
            <button type="submit" className={buttonPrimary} disabled={verifying}>
              {verifying ? t("common.saving") : t("settings.profile.mfaVerifyAndEnable")}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={buttonPrimary} onClick={startSetup} disabled={starting}>
          {starting ? t("common.saving") : t("settings.profile.mfaSetUp")}
        </button>
      )}
    </div>
  );
}

export default function ProfileTab() {
  const { t } = useTranslation();
  const { user, updateProfile, changePassword, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      await api.post("/auth/me/photo", form, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotoVersion((v) => v + 1);
      await refreshUser();
    } finally {
      setUploadingPhoto(false);
    }
  }

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
      await updateProfile(name, phone);
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
      {/* Banner + floating avatar */}
      <div>
        <div className="h-16 rounded-t-[20px] bg-mine-800/60" />
        <div className="flex items-end gap-4 px-1 -mt-9">
          <div className="rounded-full ring-4 ring-mine-950 shrink-0">
            <Avatar
              size={84}
              name={user?.name ?? "?"}
              src={user?.hasPhoto || photoVersion > 0 ? `${API_URL}/api/auth/users/${user?.id}/photo?v=${photoVersion}` : null}
            />
          </div>
          <div className="pb-1 min-w-0">
            <div className="text-base font-semibold truncate">{user?.name}</div>
            <div className="text-xs text-mine-400">
              {user?.title ? t(`settings.invites.titles.${user.title}`) : user?.role ? t(`roles.${user.role}`) : ""}
            </div>
          </div>
          <div className="pb-1 ml-auto shrink-0">
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? t("common.saving") : t("settings.profile.changePhoto")}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
        </div>
      </div>

      <form onSubmit={saveProfile} className={`${cardOuter} space-y-4`}>
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
          <label className={labelClass}>{t("settings.profile.phone")}</label>
          <input
            className={inputClass}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
          />
          <p className="text-[11px] text-mine-400 mt-1">{t("settings.profile.phoneHint")}</p>
        </div>
        <div>
          <label className={labelClass}>{t("common.role")}</label>
          <input
            className={inputClass}
            value={user?.title ? t(`settings.invites.titles.${user.title}`) : user?.role ? t(`roles.${user.role}`) : ""}
            readOnly
            disabled
          />
        </div>
        {profileError && <div className="text-danger-500 text-xs">{profileError}</div>}
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonPrimary} disabled={savingProfile}>
            {savingProfile ? t("common.saving") : t("common.save")}
          </button>
          {profileSaved && <span className="text-xs text-success-500">{t("settings.profile.saved")}</span>}
        </div>
      </form>

      <form onSubmit={savePassword} className={`${cardOuter} space-y-4`}>
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
          {passwordSaved && <span className="text-xs text-success-500">{t("settings.profile.saved")}</span>}
        </div>
      </form>

      <MfaCard />
    </div>
  );
}
