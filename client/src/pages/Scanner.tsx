import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "../api/client";
import { cardClass } from "../components/ui";

interface ScanResult {
  tone: "success" | "error";
  message: string;
}

const READER_ID = "qr-scanner-reader";
const RESCAN_COOLDOWN_MS = 4000;

export default function Scanner() {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const lastCodeRef = useRef<{ text: string; at: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScan(decodedText),
        () => {}
      )
      .then(() => setStarting(false))
      .catch(() => {
        setCameraError(t("scanner.cameraError"));
        setStarting(false);
      });

    return () => {
      scanner.stop().catch(() => {}).finally(() => scanner.clear());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan(decodedText: string) {
    const now = Date.now();
    if (lastCodeRef.current && lastCodeRef.current.text === decodedText && now - lastCodeRef.current.at < RESCAN_COOLDOWN_MS) {
      return;
    }
    if (processingRef.current) return;
    processingRef.current = true;
    lastCodeRef.current = { text: decodedText, at: now };

    try {
      if (decodedText.startsWith("visitor:")) {
        const visitorId = decodedText.slice("visitor:".length);
        const res = await api.post(`/visitors/${visitorId}/checkout`);
        setResult({ tone: "success", message: t("scanner.visitorCheckedOut", { name: res.data.fullName }) });
      } else if (decodedText.startsWith("worker:")) {
        const workerId = decodedText.slice("worker:".length);
        const res = await api.post(`/workers/${workerId}/toggle-attendance`);
        const key = res.data.action === "CHECKED_IN" ? "scanner.workerCheckedIn" : "scanner.workerCheckedOut";
        setResult({ tone: "success", message: t(key, { name: res.data.worker.name }) });
      } else {
        setResult({ tone: "error", message: t("scanner.unknownCode") });
      }
    } catch (err: any) {
      setResult({ tone: "error", message: err.response?.data?.error ?? t("scanner.actionFailed") });
    } finally {
      processingRef.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("scanner.title")}</h1>
        <p className="text-mine-300 text-sm">{t("scanner.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${cardClass} p-5`}>
          <div id={READER_ID} className="w-full rounded-md overflow-hidden bg-mine-800" />
          {starting && <div className="text-mine-300 text-sm mt-3">{t("scanner.starting")}</div>}
          {cameraError && (
            <div className="text-danger-500 text-sm mt-3 bg-danger-500/10 border border-danger-500/30 rounded-md p-3">
              {cameraError}
            </div>
          )}
        </div>

        <div className={`${cardClass} p-5 space-y-3`}>
          <h2 className="text-sm font-semibold">{t("scanner.lastResult")}</h2>
          {!result && <div className="text-mine-400 text-sm">{t("scanner.noResultYet")}</div>}
          {result && (
            <div
              className={`text-sm rounded-md p-3 border ${
                result.tone === "success"
                  ? "text-success-500 bg-success-500/10 border-success-500/30"
                  : "text-danger-500 bg-danger-500/10 border-danger-500/30"
              }`}
            >
              {result.message}
            </div>
          )}
          <div className="text-xs text-mine-400 pt-2 border-t border-mine-800">{t("scanner.hint")}</div>
        </div>
      </div>
    </div>
  );
}
