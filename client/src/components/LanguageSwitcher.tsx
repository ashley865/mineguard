import { useTranslation } from "react-i18next";
import { supportedLanguages } from "../i18n";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();

  function handleChange(lang: string) {
    i18n.changeLanguage(lang);
    localStorage.setItem("mineguard_lang", lang);
  }

  return (
    <select
      aria-label={t("language.label")}
      value={i18n.resolvedLanguage ?? i18n.language}
      onChange={(e) => handleChange(e.target.value)}
      className={`bg-mine-900 border border-mine-700 rounded-md px-2 py-1 text-xs text-mine-50 focus:outline-none focus:ring-2 focus:ring-hazard-500 ${className}`}
    >
      {supportedLanguages.map((lang) => (
        <option key={lang} value={lang}>
          {t(`language.${lang}`)}
        </option>
      ))}
    </select>
  );
}
