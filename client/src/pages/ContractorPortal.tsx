import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useContractorAuth } from "../context/ContractorAuthContext";
import { contractorApi } from "../api/contractorClient";
import { ContractorDocument, PermitToWork } from "../api/types";
import { StatusBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { LogoMark, Wordmark } from "../components/Logo";

function ChangePasswordCard() {
  const { t } = useTranslation();
  const { changePassword } = useContractorAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("contractorPortal.changePasswordError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${cardClass} p-4 space-y-3`}>
      <h2 className="text-sm font-semibold">{t("contractorPortal.changePasswordTitle")}</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>{t("contractorPortal.currentPassword")}</label>
          <input className={inputClass} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("contractorPortal.newPassword")}</label>
          <input className={inputClass} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
        </div>
        {error && <div className="text-danger-500 text-xs">{error}</div>}
        {done && <div className="text-success-500 text-xs">{t("contractorPortal.changePasswordSuccess")}</div>}
        <button type="submit" className={buttonSecondary} disabled={submitting}>
          {submitting ? t("common.saving") : t("contractorPortal.changePasswordSubmit")}
        </button>
      </form>
    </div>
  );
}

async function downloadDocument(docId: string, fileName: string) {
  const res = await contractorApi.get(`/contractor-auth/me/documents/${docId}/download`, { responseType: "blob" });
  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function ContractorPortal() {
  const { t } = useTranslation();
  const { contractor, loading, logout } = useContractorAuth();
  const [permits, setPermits] = useState<PermitToWork[]>([]);
  const [permitsLoading, setPermitsLoading] = useState(true);

  useEffect(() => {
    if (!contractor) return;
    contractorApi.get<PermitToWork[]>("/contractor-auth/me/permits").then((res) => {
      setPermits(res.data);
      setPermitsLoading(false);
    });
  }, [contractor]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-mine-950 text-mine-100">{t("common.loading")}</div>;
  }
  if (!contractor) {
    return <Navigate to="/contractor-login" replace />;
  }

  return (
    <div className="min-h-screen bg-mine-950">
      <div className="border-b border-mine-800 bg-mine-900 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-lg font-bold tracking-tight flex items-center gap-2"><LogoMark size={20} /><Wordmark /> {t("contractorPortal.title")}</div>
            <p className="text-mine-300 text-sm">{contractor.companyName}</p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button className={buttonSecondary} onClick={logout}>{t("contractorPortal.logout")}</button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className={`${cardClass} p-4 space-y-2`}>
          <div className="flex items-center gap-2">
            <StatusBadge status={contractor.status} />
            <span className="text-xs text-mine-400">{contractor.site?.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2">
            <div><span className="text-mine-400">{t("contractors.scopeOfWork")}:</span> {contractor.scopeOfWork}</div>
            <div><span className="text-mine-400">{t("contractors.contactName")}:</span> {contractor.contactName}</div>
            <div>
              <span className="text-mine-400">{t("contractors.contractStartDate")}:</span>{" "}
              {new Date(contractor.contractStartDate).toLocaleDateString()}
            </div>
            <div>
              <span className="text-mine-400">{t("contractors.contractEndDate")}:</span>{" "}
              {new Date(contractor.contractEndDate).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className={`${cardClass} p-4 space-y-3`}>
          <h2 className="text-sm font-semibold">{t("contractorPortal.documentsTitle")}</h2>
          <div className="space-y-1">
            {contractor.documents.map((d: ContractorDocument) => (
              <button
                key={d.id}
                className="flex items-center justify-between w-full text-xs text-mine-300 hover:text-mine-50 border border-mine-800 rounded-md px-3 py-2"
                onClick={() => downloadDocument(d.id, d.fileName)}
              >
                <span>{d.fileName}</span>
                <span className="text-mine-500">{t(`documents.categoryLabels.CONTRACTOR.${d.docType}`)}</span>
              </button>
            ))}
            {contractor.documents.length === 0 && <div className="text-xs text-mine-400">{t("contractorPortal.noDocuments")}</div>}
          </div>
        </div>

        <div className={`${cardClass} p-4 space-y-3`}>
          <h2 className="text-sm font-semibold">{t("contractorPortal.permitsTitle")}</h2>
          {permitsLoading && <div className="text-mine-300 text-xs">{t("common.loading")}</div>}
          {!permitsLoading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">{t("permitToWork.workArea")}</th>
                    <th className="text-left px-3 py-2">{t("permitToWork.startDate")}</th>
                    <th className="text-left px-3 py-2">{t("permitToWork.endDate")}</th>
                    <th className="text-left px-3 py-2">{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((p) => (
                    <tr key={p.id} className="border-t border-mine-800">
                      <td className="px-3 py-2">{p.workArea}</td>
                      <td className="px-3 py-2 text-mine-300">{new Date(p.startDate).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-mine-300">{new Date(p.endDate).toLocaleDateString()}</td>
                      <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                  {permits.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-mine-400">{t("contractorPortal.noPermits")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ChangePasswordCard />
      </div>
    </div>
  );
}
