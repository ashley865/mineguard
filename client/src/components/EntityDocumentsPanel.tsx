import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatFileSize } from "../lib/formatFileSize";
import FileDropzone from "./FileDropzone";
import { buttonDanger, labelClass, selectClass } from "./ui";

interface EntityDocument {
  id: string;
  docType: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  createdAt: string;
}

export default function EntityDocumentsPanel({
  documents,
  docTypeOptions,
  docTypeI18nPrefix,
  onUpload,
  onDownload,
  onDelete,
  canUpload,
}: {
  documents: EntityDocument[];
  docTypeOptions: string[];
  docTypeI18nPrefix: string;
  onUpload: (file: File, docType: string) => Promise<void>;
  onDownload: (doc: EntityDocument) => void;
  onDelete?: (doc: EntityDocument) => void;
  canUpload: boolean;
}) {
  const { t } = useTranslation();
  const [docType, setDocType] = useState(docTypeOptions[0] ?? "OTHER");
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList) {
    const file = files.item(0);
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file, docType);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {documents.length === 0 && <div className="text-xs text-mine-400">{t("documents.entityPanel.noneYet")}</div>}
        {documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 text-xs border-t border-mine-800 pt-1.5 first:border-t-0 first:pt-0">
            <div className="min-w-0">
              <button className="hover:underline truncate block" onClick={() => onDownload(d)}>
                {d.fileName}
              </button>
              <div className="text-mine-400">
                {t(`${docTypeI18nPrefix}.${d.docType}`)} · {formatFileSize(d.fileSize)}
              </div>
            </div>
            {onDelete && (
              <button className={`${buttonDanger} shrink-0`} onClick={() => onDelete(d)}>
                {t("common.delete")}
              </button>
            )}
          </div>
        ))}
      </div>

      {canUpload && (
        <div className="space-y-2 border-t border-mine-800 pt-3">
          <div>
            <label className={labelClass}>{t("documents.entityPanel.docType")}</label>
            <select className={selectClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {docTypeOptions.map((dt) => <option key={dt} value={dt}>{t(`${docTypeI18nPrefix}.${dt}`)}</option>)}
            </select>
          </div>
          <FileDropzone accept="image/*,.pdf" onFiles={handleFiles} hint={uploading ? (t("common.saving") ?? undefined) : undefined} />
        </div>
      )}
    </div>
  );
}
