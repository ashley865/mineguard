import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BuyerType } from "../api/types";
import { useBuyerAuth } from "../context/BuyerAuthContext";
import { buttonPrimary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";
import DateField from "../components/DateField";
import FileDropzone from "../components/FileDropzone";
import { isValidIdOrPassport } from "../lib/saId";
import { LogoMark, Wordmark } from "../components/Logo";

const buyerTypes: BuyerType[] = ["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"];

export default function BuyerRegister() {
  const { t } = useTranslation();
  const { registerWithForm } = useBuyerAuth();
  const navigate = useNavigate();

  const [buyerType, setBuyerType] = useState<BuyerType>("COMPANY");
  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [dealerLicenseNumber, setDealerLicenseNumber] = useState("");
  const [dealerLicenseAuthority, setDealerLicenseAuthority] = useState("");
  const [dealerLicenseExpiry, setDealerLicenseExpiry] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [postalAddress, setPostalAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankBranchCode, setBankBranchCode] = useState("");
  const [bbbeeLevel, setBbbeeLevel] = useState("");
  const [sourceOfFunds, setSourceOfFunds] = useState("");
  const [documents, setDocuments] = useState<FileList | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [popiaConsentAccepted, setPopiaConsentAccepted] = useState(false);
  const [ficaDeclarationAccepted, setFicaDeclarationAccepted] = useState(false);
  const [amlDeclarationAccepted, setAmlDeclarationAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!popiaConsentAccepted || !ficaDeclarationAccepted || !amlDeclarationAccepted) {
      setError(t("buyerRegister.declarationsRequired"));
      return;
    }
    if (buyerType !== "INDIVIDUAL" && !registrationNumber) {
      setError(t("buyerRegister.registrationNumberRequired"));
      return;
    }
    if (buyerType === "INDIVIDUAL" && !idNumber) {
      setError(t("buyerRegister.idNumberRequired"));
      return;
    }
    if (buyerType === "INDIVIDUAL" && idNumber && !isValidIdOrPassport(idNumber)) {
      setError(t("buyerRegister.idNumberInvalid"));
      return;
    }
    if (!documents || documents.length === 0) {
      setError(t("buyerRegister.documentsRequired"));
      return;
    }
    if (password.length < 8) {
      setError(t("buyerRegister.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("buyerRegister.passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("buyerType", buyerType);
      form.append("legalName", legalName);
      if (tradingName) form.append("tradingName", tradingName);
      if (registrationNumber) form.append("registrationNumber", registrationNumber);
      if (idNumber) form.append("idNumber", idNumber);
      form.append("taxNumber", taxNumber);
      if (vatNumber) form.append("vatNumber", vatNumber);
      if (dealerLicenseNumber) form.append("dealerLicenseNumber", dealerLicenseNumber);
      if (dealerLicenseAuthority) form.append("dealerLicenseAuthority", dealerLicenseAuthority);
      if (dealerLicenseExpiry) form.append("dealerLicenseExpiry", dealerLicenseExpiry);
      form.append("physicalAddress", physicalAddress);
      if (postalAddress) form.append("postalAddress", postalAddress);
      form.append("contactName", contactName);
      form.append("contactPhone", contactPhone);
      form.append("contactEmail", contactEmail);
      if (bankName) form.append("bankName", bankName);
      if (bankAccountHolder) form.append("bankAccountHolder", bankAccountHolder);
      if (bankAccountNumber) form.append("bankAccountNumber", bankAccountNumber);
      if (bankBranchCode) form.append("bankBranchCode", bankBranchCode);
      if (bbbeeLevel) form.append("bbbeeLevel", bbbeeLevel);
      form.append("sourceOfFunds", sourceOfFunds);
      form.append("popiaConsentAccepted", "true");
      form.append("ficaDeclarationAccepted", "true");
      form.append("amlDeclarationAccepted", "true");
      form.append("password", password);
      Array.from(documents).forEach((file) => form.append("documents", file));

      await registerWithForm(form);
      navigate("/buyer-portal");
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("buyerRegister.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-mine-950 flex items-center justify-center p-4 py-8">
      <div className={`${cardClass} p-6 w-full max-w-2xl space-y-5`}>
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div>
          <div className="text-lg font-bold tracking-tight flex items-center gap-2"><LogoMark size={20} /><Wordmark /></div>
          <h1 className="text-base font-semibold mt-2">{t("buyerRegister.title")}</h1>
          <p className="text-mine-300 text-sm">{t("buyerRegister.subtitle")}</p>
        </div>

        <div className="text-xs text-mine-400 bg-mine-800/40 border border-mine-800 rounded-md p-3">
          {t("buyerRegister.legalNote")}
        </div>

        {error && <div className="text-danger-500 text-sm bg-danger-500/10 border border-danger-500/30 rounded-md px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs font-semibold text-mine-300 uppercase pt-2">{t("buyerRegister.sectionIdentity")}</div>
          <div>
            <label className={labelClass}>{t("buyerRegister.buyerType")}</label>
            <select className={selectClass} value={buyerType} onChange={(e) => setBuyerType(e.target.value as BuyerType)}>
              {buyerTypes.map((bt) => <option key={bt} value={bt}>{t(`buyerRegister.types.${bt}`)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("buyerRegister.legalName")}</label>
              <input className={inputClass} value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.tradingName")}</label>
              <input className={inputClass} value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {buyerType !== "INDIVIDUAL" && (
              <div>
                <label className={labelClass}>{t("buyerRegister.registrationNumber")}</label>
                <input className={inputClass} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required />
              </div>
            )}
            {buyerType === "INDIVIDUAL" && (
              <div>
                <label className={labelClass}>{t("buyerRegister.idNumber")}</label>
                <input className={inputClass} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required />
              </div>
            )}
            <div>
              <label className={labelClass}>{t("buyerRegister.taxNumber")}</label>
              <input className={inputClass} value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("buyerRegister.vatNumber")}</label>
              <input className={inputClass} value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.bbbeeLevel")}</label>
              <input className={inputClass} value={bbbeeLevel} onChange={(e) => setBbbeeLevel(e.target.value)} />
            </div>
          </div>

          <div className="text-xs font-semibold text-mine-300 uppercase pt-2 border-t border-mine-800">
            {t("buyerRegister.sectionLicense")}
          </div>
          <p className="text-xs text-mine-400">{t("buyerRegister.licenseHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("buyerRegister.dealerLicenseNumber")}</label>
              <input className={inputClass} value={dealerLicenseNumber} onChange={(e) => setDealerLicenseNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.dealerLicenseAuthority")}</label>
              <input className={inputClass} value={dealerLicenseAuthority} onChange={(e) => setDealerLicenseAuthority(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("buyerRegister.dealerLicenseExpiry")}</label>
            <DateField value={dealerLicenseExpiry} onChange={setDealerLicenseExpiry} />
          </div>

          <div className="text-xs font-semibold text-mine-300 uppercase pt-2 border-t border-mine-800">
            {t("buyerRegister.sectionContact")}
          </div>
          <div>
            <label className={labelClass}>{t("buyerRegister.physicalAddress")}</label>
            <textarea className={inputClass} rows={2} value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t("buyerRegister.postalAddress")}</label>
            <textarea className={inputClass} rows={2} value={postalAddress} onChange={(e) => setPostalAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("buyerRegister.contactName")}</label>
              <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.contactPhone")}</label>
              <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("buyerRegister.contactEmail")}</label>
            <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
          </div>

          <div className="text-xs font-semibold text-mine-300 uppercase pt-2 border-t border-mine-800">
            {t("buyerRegister.sectionBanking")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("buyerRegister.bankName")}</label>
              <input className={inputClass} value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.bankAccountHolder")}</label>
              <input className={inputClass} value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("buyerRegister.bankAccountNumber")}</label>
              <input className={inputClass} value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.bankBranchCode")}</label>
              <input className={inputClass} value={bankBranchCode} onChange={(e) => setBankBranchCode(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("buyerRegister.sourceOfFunds")}</label>
            <textarea className={inputClass} rows={2} value={sourceOfFunds} onChange={(e) => setSourceOfFunds(e.target.value)} required />
          </div>

          <div className="text-xs font-semibold text-mine-300 uppercase pt-2 border-t border-mine-800">
            {t("buyerRegister.sectionDocuments")}
          </div>
          <div>
            <label className={labelClass}>{t("buyerRegister.documents")}</label>
            <FileDropzone multiple accept="image/*,.pdf" hint={t("buyerRegister.documentsHint")} onFiles={setDocuments} />
          </div>

          <div className="text-xs font-semibold text-mine-300 uppercase pt-2 border-t border-mine-800">
            {t("buyerRegister.sectionAccount")}
          </div>
          <p className="text-xs text-mine-400">{t("buyerRegister.accountHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("buyerRegister.password")}</label>
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <div>
              <label className={labelClass}>{t("buyerRegister.confirmPassword")}</label>
              <input className={inputClass} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
            </div>
          </div>

          <div className="space-y-2 border border-mine-800 rounded-md p-3 bg-mine-900/40">
            <p className="text-xs text-mine-400">
              {t("buyerRegister.declarationsIntro")}{" "}
              <Link to="/privacy-policy" target="_blank" className="underline hover:text-mine-100">
                {t("login.privacyPolicy")}
              </Link>
            </p>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={popiaConsentAccepted} onChange={(e) => setPopiaConsentAccepted(e.target.checked)} />
              <span>{t("buyerRegister.popiaDeclaration")}</span>
            </label>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={ficaDeclarationAccepted} onChange={(e) => setFicaDeclarationAccepted(e.target.checked)} />
              <span>{t("buyerRegister.ficaDeclaration")}</span>
            </label>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={amlDeclarationAccepted} onChange={(e) => setAmlDeclarationAccepted(e.target.checked)} />
              <span>{t("buyerRegister.amlDeclaration")}</span>
            </label>
          </div>

          <button type="submit" className={`${buttonPrimary} w-full`} disabled={submitting}>
            {submitting ? t("common.saving") : t("buyerRegister.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
