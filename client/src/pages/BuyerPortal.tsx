import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBuyerAuth } from "../context/BuyerAuthContext";
import { buyerApi } from "../api/buyerClient";
import { BuyerDocument, MineralBid } from "../api/types";
import { StatusBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";

function ChangePasswordCard() {
  const { t } = useTranslation();
  const { changePassword } = useBuyerAuth();
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
      setError(err.response?.data?.error ?? t("buyerPortal.changePasswordError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${cardClass} p-4 space-y-3`}>
      <h2 className="text-sm font-semibold">{t("buyerPortal.changePasswordTitle")}</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>{t("buyerPortal.currentPassword")}</label>
          <input className={inputClass} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("buyerPortal.newPassword")}</label>
          <input className={inputClass} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
        </div>
        {error && <div className="text-danger-500 text-xs">{error}</div>}
        {done && <div className="text-success-500 text-xs">{t("buyerPortal.changePasswordSuccess")}</div>}
        <button type="submit" className={buttonSecondary} disabled={submitting}>
          {submitting ? t("common.saving") : t("buyerPortal.changePasswordSubmit")}
        </button>
      </form>
    </div>
  );
}

async function downloadDocument(docId: string, fileName: string) {
  const res = await buyerApi.get(`/buyer-auth/me/documents/${docId}/download`, { responseType: "blob" });
  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function BuyerPortal() {
  const { t } = useTranslation();
  const { buyer, loading, logout } = useBuyerAuth();
  const [bids, setBids] = useState<MineralBid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(true);

  useEffect(() => {
    if (!buyer) return;
    buyerApi.get<MineralBid[]>("/buyer-auth/me/bids").then((res) => {
      setBids(res.data);
      setBidsLoading(false);
    });
  }, [buyer]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-mine-950 text-mine-100">{t("common.loading")}</div>;
  }
  if (!buyer) {
    return <Navigate to="/buyer-login" replace />;
  }

  return (
    <div className="min-h-screen bg-mine-950">
      <div className="border-b border-mine-800 bg-mine-900 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-lg font-bold tracking-tight">⛏ Mine Guard {t("buyerPortal.title")}</div>
            <p className="text-mine-300 text-sm">{buyer.legalName}</p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/buy" className={buttonPrimary}>{t("buyerPortal.browseMarketplace")}</Link>
            <button className={buttonSecondary} onClick={logout}>{t("buyerPortal.logout")}</button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className={`${cardClass} p-4 space-y-2`}>
          <div className="flex items-center gap-2">
            <StatusBadge status={buyer.status} />
            <span className="text-xs text-mine-400">{buyer.contactEmail}</span>
          </div>
          {buyer.status === "PENDING_REVIEW" && <p className="text-xs text-mine-400">{t("buyerPortal.statusPendingHint")}</p>}
          {buyer.status === "REJECTED" && <p className="text-xs text-danger-500">{t("buyerPortal.statusRejectedHint")}</p>}
          {buyer.reviewNote && (
            <p className="text-xs text-mine-400 italic">{t("marketplace.reviewNote")}: "{buyer.reviewNote}"</p>
          )}
        </div>

        <div className={`${cardClass} p-4 space-y-3`}>
          <h2 className="text-sm font-semibold">{t("buyerPortal.documentsTitle")}</h2>
          <div className="space-y-1">
            {buyer.documents.map((d: BuyerDocument) => (
              <button
                key={d.id}
                className="flex items-center justify-between w-full text-xs text-mine-300 hover:text-mine-50 border border-mine-800 rounded-md px-3 py-2"
                onClick={() => downloadDocument(d.id, d.fileName)}
              >
                <span>{d.fileName}</span>
                <span className="text-mine-500">{t(`documents.categoryLabels.BUYER.${d.docType}`)}</span>
              </button>
            ))}
            {buyer.documents.length === 0 && <div className="text-xs text-mine-400">{t("buyerPortal.noDocuments")}</div>}
          </div>
        </div>

        <div className={`${cardClass} p-4 space-y-3`}>
          <h2 className="text-sm font-semibold">{t("buyerPortal.bidsTitle")}</h2>
          {bidsLoading && <div className="text-mine-300 text-xs">{t("common.loading")}</div>}
          {!bidsLoading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">{t("marketplace.mineralType")}</th>
                    <th className="text-left px-3 py-2">{t("marketplace.quantity")}</th>
                    <th className="text-left px-3 py-2">{t("marketplace.offerPrice")}</th>
                    <th className="text-left px-3 py-2">{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((b) => (
                    <tr key={b.id} className="border-t border-mine-800">
                      <td className="px-3 py-2">{b.listing ? t(`mineralTypes.${b.listing.mineralType}`) : "—"}</td>
                      <td className="px-3 py-2 text-mine-300">{b.quantity} {b.listing?.unit}</td>
                      <td className="px-3 py-2 text-mine-300">{b.offerPrice}</td>
                      <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                  {bids.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-mine-400">{t("buyerPortal.noBids")}</td></tr>
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
