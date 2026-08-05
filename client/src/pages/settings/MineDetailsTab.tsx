import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { Mine } from "../../api/types";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../../components/ui";

export default function MineDetailsTab() {
  const { t } = useTranslation();
  const [mine, setMine] = useState<Mine | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoVersion, setLogoVersion] = useState(0);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [miningRightNumber, setMiningRightNumber] = useState("");
  const [description, setDescription] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankBranchCode, setBankBranchCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<Mine>("/mines/mine");
    setMine(res.data);
    setName(res.data.name);
    setLocation(res.data.location);
    setRegistrationNumber(res.data.registrationNumber ?? "");
    setMiningRightNumber(res.data.miningRightNumber ?? "");
    setDescription(res.data.description ?? "");
    setBankName(res.data.bankName ?? "");
    setBankAccountHolder(res.data.bankAccountHolder ?? "");
    setBankAccountNumber(res.data.bankAccountNumber ?? "");
    setBankBranchCode(res.data.bankBranchCode ?? "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api.put<Mine>("/mines/mine", {
        name,
        location,
        registrationNumber: registrationNumber || null,
        miningRightNumber: miningRightNumber || null,
        description: description || null,
        bankName: bankName || null,
        bankAccountHolder: bankAccountHolder || null,
        bankAccountNumber: bankAccountNumber || null,
        bankBranchCode: bankBranchCode || null,
      });
      setMine(res.data);
      setBankName(res.data.bankName ?? "");
      setBankAccountHolder(res.data.bankAccountHolder ?? "");
      setBankAccountNumber(res.data.bankAccountNumber ?? "");
      setBankBranchCode(res.data.bankBranchCode ?? "");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("settings.mine.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append("logo", logoFile);
      await api.post("/mines/mine/logo", form, { headers: { "Content-Type": "multipart/form-data" } });
      setLogoFile(null);
      setLogoVersion((v) => v + 1);
      await load();
    } finally {
      setUploadingLogo(false);
    }
  }

  if (loading || !mine) return <div className="text-mine-300">{t("settings.mine.loading")}</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div className={`${cardClass} p-5 space-y-4`}>
        <h2 className="text-sm font-semibold">{t("settings.mine.logoTitle")}</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg border border-mine-800 bg-mine-800/40 flex items-center justify-center overflow-hidden shrink-0">
            {mine.hasLogo ? (
              <img
                src={`${API_URL}/api/mines/${mine.id}/logo?v=${logoVersion}`}
                alt="Mine logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-2xl">⛏</span>
            )}
          </div>
          <div className="flex-1 flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              className={`${inputClass} text-xs`}
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
            <button type="button" className={buttonSecondary} disabled={!logoFile || uploadingLogo} onClick={uploadLogo}>
              {uploadingLogo ? t("common.saving") : t("settings.mine.uploadLogo")}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={`${cardClass} p-5 space-y-4`}>
        <h2 className="text-sm font-semibold">{t("settings.mine.title")}</h2>
        <div>
          <label className={labelClass}>{t("registerMine.mineName")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
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
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="border-t border-mine-800 pt-4">
          <div className="text-xs font-semibold text-mine-300 uppercase mb-2">{t("settings.mine.bankingDetails")}</div>
          <p className="text-xs text-mine-400 mb-3">{t("settings.mine.bankingDetailsHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("buyerRegister.bankName")}</label>
              <input className={inputClass} value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.bankAccountHolder")}</label>
              <input className={inputClass} value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.bankAccountNumber")}</label>
              <input className={inputClass} value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.bankBranchCode")}</label>
              <input className={inputClass} value={bankBranchCode} onChange={(e) => setBankBranchCode(e.target.value)} />
            </div>
          </div>
        </div>
        {error && <div className="text-danger-500 text-xs">{error}</div>}
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonPrimary} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </button>
          {saved && <span className="text-xs text-success-500">{t("settings.profile.saved")}</span>}
        </div>
      </form>
    </div>
  );
}
