import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { api } from "../api/client";
import { Site } from "../api/types";
import ContractOpportunitiesTab from "./marketplace/ContractOpportunitiesTab";
import Modal from "../components/Modal";
import { buttonSecondary, inputClass } from "../components/ui";

function ShareTenderModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/tender-board`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { width: 220, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal title={t("tenders.shareTitle")} onClose={onClose}>
      <div className="space-y-4">
        {dataUrl && (
          <div className="flex flex-col items-center gap-2">
            <img src={dataUrl} alt="Tender board QR code" className="rounded-md border border-mine-800" />
          </div>
        )}
        <div className="flex gap-2">
          <input readOnly className={`${inputClass} font-mono text-xs`} value={link} onFocus={(e) => e.target.select()} />
          <button type="button" className={buttonSecondary} onClick={copyLink}>
            {copied ? t("registerMine.copied") : t("registerMine.copy")}
          </button>
        </div>
        <p className="text-xs text-mine-400">{t("tenders.shareHint")}</p>
      </div>
    </Modal>
  );
}

export default function Tenders() {
  const { t } = useTranslation();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareModal, setShareModal] = useState(false);

  useEffect(() => {
    api.get<Site[]>("/sites").then((res) => {
      setSites(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("tenders.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("tenders.subtitle")}</p>
        </div>
        <button className={buttonSecondary} onClick={() => setShareModal(true)}>{t("tenders.shareLink")}</button>
      </div>

      <ContractOpportunitiesTab sites={sites} />

      {shareModal && <ShareTenderModal onClose={() => setShareModal(false)} />}
    </div>
  );
}
