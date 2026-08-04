import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import { buttonDanger, buttonSecondary, inputClass, labelClass } from "./ui";

export default function PasswordConfirmModal({ title, hint, onConfirm, onClose }: {
  title: string;
  hint: string;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("documents.vault.deleteError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-mine-400">{hint}</p>
        <div>
          <label className={labelClass}>{t("documents.vault.confirmPassword")}</label>
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
        </div>
        {error && <div className="text-danger-500 text-xs">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={buttonSecondary} onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className={buttonDanger} disabled={submitting}>
            {submitting ? t("common.saving") : t("common.delete")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
