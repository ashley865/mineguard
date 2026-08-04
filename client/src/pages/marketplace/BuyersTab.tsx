import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { Buyer, BuyerDocumentType, BuyerStatus } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import EntityDocumentsPanel from "../../components/EntityDocumentsPanel";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass } from "../../components/ui";

const statusFilters: (BuyerStatus | "ALL")[] = ["ALL", "PENDING_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"];
const buyerDocTypes: BuyerDocumentType[] = ["ID_OR_REGISTRATION", "PROOF_OF_ADDRESS", "DEALER_LICENSE", "TAX_CLEARANCE", "OTHER"];

function BuyerDetailModal({ buyer, onClose, onReviewed }: { buyer: Buyer; onClose: () => void; onReviewed: () => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function review(decision: "APPROVED" | "REJECTED") {
    setSubmitting(true);
    try {
      await api.post(`/buyers/${buyer.id}/review`, { decision, note: note || undefined });
      onReviewed();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function suspend() {
    setSubmitting(true);
    try {
      await api.post(`/buyers/${buyer.id}/suspend`);
      onReviewed();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function download(doc: { id: string; fileName: string }) {
    const res = await api.get(`/buyers/${buyer.id}/documents/${doc.id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async function upload(file: File, docType: string) {
    const form = new FormData();
    form.append("file", file);
    form.append("docType", docType);
    await api.post(`/buyers/${buyer.id}/documents`, form, { headers: { "Content-Type": "multipart/form-data" } });
    onReviewed();
  }

  return (
    <Modal title={buyer.legalName} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2">
          <StatusBadge status={buyer.status} />
          <span className="text-xs text-mine-400">{t(`buyerRegister.types.${buyer.buyerType}`)}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div><span className="text-mine-400">{t("buyerRegister.registrationNumber")}:</span> {buyer.registrationNumber || buyer.idNumber || "—"}</div>
          <div><span className="text-mine-400">{t("buyerRegister.taxNumber")}:</span> {buyer.taxNumber}</div>
          <div><span className="text-mine-400">{t("buyerRegister.vatNumber")}:</span> {buyer.vatNumber || "—"}</div>
          <div><span className="text-mine-400">{t("buyerRegister.bbbeeLevel")}:</span> {buyer.bbbeeLevel || "—"}</div>
          <div className="col-span-2"><span className="text-mine-400">{t("buyerRegister.physicalAddress")}:</span> {buyer.physicalAddress}</div>
          <div><span className="text-mine-400">{t("buyerRegister.contactName")}:</span> {buyer.contactName}</div>
          <div><span className="text-mine-400">{t("common.phone")}:</span> {buyer.contactPhone}</div>
          <div className="col-span-2"><span className="text-mine-400">{t("buyerRegister.contactEmail")}:</span> {buyer.contactEmail}</div>
          <div className="col-span-2"><span className="text-mine-400">{t("buyerRegister.sourceOfFunds")}:</span> {buyer.sourceOfFunds}</div>
          {buyer.dealerLicenseNumber && (
            <div className="col-span-2">
              <span className="text-mine-400">{t("buyerRegister.dealerLicenseNumber")}:</span> {buyer.dealerLicenseNumber}
              {buyer.dealerLicenseAuthority ? ` (${buyer.dealerLicenseAuthority})` : ""}
            </div>
          )}
        </div>

        <div className="text-xs space-y-1">
          <div className={buyer.popiaConsentAccepted ? "text-success-500" : "text-danger-500"}>
            {buyer.popiaConsentAccepted ? "✓" : "✗"} {t("buyerRegister.popiaDeclaration")}
          </div>
          <div className={buyer.ficaDeclarationAccepted ? "text-success-500" : "text-danger-500"}>
            {buyer.ficaDeclarationAccepted ? "✓" : "✗"} {t("buyerRegister.ficaDeclaration")}
          </div>
          <div className={buyer.amlDeclarationAccepted ? "text-success-500" : "text-danger-500"}>
            {buyer.amlDeclarationAccepted ? "✓" : "✗"} {t("buyerRegister.amlDeclaration")}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-mine-300 uppercase mb-1">{t("buyerRegister.sectionDocuments")}</div>
          <EntityDocumentsPanel
            documents={buyer.documents}
            docTypeOptions={buyerDocTypes}
            docTypeI18nPrefix="documents.categoryLabels.BUYER"
            onUpload={upload}
            onDownload={download}
            canUpload
          />
        </div>

        {buyer.reviewNote && (
          <div className="text-xs text-mine-400 italic">{t("marketplace.reviewNote")}: "{buyer.reviewNote}"</div>
        )}

        {buyer.status === "PENDING_REVIEW" && (
          <div className="border-t border-mine-800 pt-3 space-y-2">
            <input
              className={inputClass}
              placeholder={t("common.reviewNotePlaceholder") ?? ""}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button className={buttonPrimary} disabled={submitting} onClick={() => review("APPROVED")}>{t("common.approve")}</button>
              <button className={buttonSecondary} disabled={submitting} onClick={() => review("REJECTED")}>{t("common.reject")}</button>
            </div>
          </div>
        )}
        {buyer.status === "APPROVED" && (
          <div className="border-t border-mine-800 pt-3">
            <button className={buttonDanger} disabled={submitting} onClick={suspend}>{t("marketplace.suspendBuyer")}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function BuyersTab() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(BuyerStatus | "ALL")>("PENDING_REVIEW");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((b) => b.id === selectedId) ?? null;

  async function load() {
    setLoading(true);
    const res = await api.get<Buyer[]>("/buyers", { params: statusFilter === "ALL" ? undefined : { status: statusFilter } });
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={s}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === s ? "bg-hazard-500 text-white border-hazard-500" : "border-mine-700 text-mine-300 hover:bg-mine-800"
            }`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "ALL" ? t("marketplace.allBuyers") : t(`badges.status.${s}`)}
          </button>
        ))}
      </div>

      {loading && <div className="text-mine-300">{t("common.loading")}</div>}

      {!loading && (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("buyerRegister.legalName")}</th>
                <th className="text-left px-4 py-2">{t("buyerRegister.contactEmail")}</th>
                <th className="text-left px-4 py-2">{t("common.type")}</th>
                <th className="text-left px-4 py-2">{t("common.status")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{b.legalName}</td>
                  <td className="px-4 py-2 text-mine-300">{b.contactEmail}</td>
                  <td className="px-4 py-2 text-mine-300">{t(`buyerRegister.types.${b.buyerType}`)}</td>
                  <td className="px-4 py-2"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setSelectedId(b.id)}>{t("marketplace.review")}</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("marketplace.noneYetBuyers")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && <BuyerDetailModal buyer={selected} onClose={() => setSelectedId(null)} onReviewed={load} />}
    </div>
  );
}
