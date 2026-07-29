import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";

export const supportedLanguages = ["en", "es", "fr"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

const stored = localStorage.getItem("mineguard_lang");
const initialLanguage = supportedLanguages.includes(stored as SupportedLanguage)
  ? (stored as SupportedLanguage)
  : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
