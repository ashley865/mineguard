import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { buyerApi } from "../api/buyerClient";
import { contractorApi } from "../api/contractorClient";
import { cardClass, buttonPrimary } from "../components/ui";
import { LogoMark, Wordmark } from "../components/Logo";

type AccountType = "buyer" | "contractor";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token");
  const type = params.get("type") as AccountType | null;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || (type !== "buyer" && type !== "contractor")) {
      setStatus("error");
      setMessage(t("verifyEmail.invalidLink"));
      return;
    }
    const api = type === "buyer" ? buyerApi : contractorApi;
    const path = type === "buyer" ? "/buyer-auth/verify-email" : "/contractor-auth/verify-email";
    api
      .post(path, { token })
      .then((res) => {
        setStatus(res.data.success ? "success" : "error");
        setMessage(res.data.message);
      })
      .catch(() => {
        setStatus("error");
        setMessage(t("verifyEmail.genericError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, type]);

  const loginLink = type === "contractor" ? "/contractor-login" : "/buyer-login";

  return (
    <div className="min-h-screen bg-mine-950 flex items-center justify-center p-4">
      <div className={`${cardClass} p-6 w-full max-w-md text-center space-y-4`}>
        <div className="flex justify-center items-center gap-2"><LogoMark size={28} /><Wordmark /></div>
        {status === "loading" && <p className="text-sm text-mine-300">{t("verifyEmail.verifying")}</p>}
        {status !== "loading" && (
          <>
            <h1 className="text-base font-semibold">{status === "success" ? t("verifyEmail.successTitle") : t("verifyEmail.errorTitle")}</h1>
            <p className="text-sm text-mine-300">{message}</p>
            <Link to={loginLink} className={`${buttonPrimary} w-full block text-center`}>
              {t("verifyEmail.goToLogin")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
