import { useTranslation } from "react-i18next";
import { buttonSecondary } from "./ui";

// Shown in place of a page/tab's content when its initial data load fails, so a
// transient server error leaves the user with a retry button instead of a
// spinner that never resolves.
export default function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-mine-300">{t("common.loadError")}</p>
      <button className={buttonSecondary} onClick={onRetry}>{t("common.retry")}</button>
    </div>
  );
}
