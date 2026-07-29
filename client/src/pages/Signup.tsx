import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { buttonPrimary, inputClass, labelClass } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Signup() {
  const { t } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "EXECUTIVE">("ADMIN");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name, role);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error?.formErrors?.[0] ?? err.response?.data?.error ?? t("signup.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mine-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div className="text-3xl font-bold">⛏ Mine Guard</div>
          <div className="text-mine-300 text-sm mt-1">{t("signup.title")}</div>
        </div>
        <form onSubmit={handleSubmit} className="bg-mine-900 border border-mine-800 rounded-lg p-6 space-y-4">
          <div>
            <label className={labelClass}>{t("signup.fullName")}</label>
            <input
              className={inputClass}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t("signup.email")}</label>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t("signup.password")}</label>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <div className="text-xs text-mine-400 mt-1">{t("signup.passwordHint")}</div>
          </div>
          <div>
            <label className={labelClass}>{t("signup.accountType")}</label>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ${
                  role === "ADMIN" ? "border-mine-500 bg-mine-800/40" : "border-mine-800"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  className="mt-1"
                  checked={role === "ADMIN"}
                  onChange={() => setRole("ADMIN")}
                />
                <div>
                  <div className="text-sm font-medium">{t("signup.admin")}</div>
                  <div className="text-xs text-mine-400">{t("signup.adminDesc")}</div>
                </div>
              </label>
              <label
                className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ${
                  role === "EXECUTIVE" ? "border-mine-500 bg-mine-800/40" : "border-mine-800"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  className="mt-1"
                  checked={role === "EXECUTIVE"}
                  onChange={() => setRole("EXECUTIVE")}
                />
                <div>
                  <div className="text-sm font-medium">{t("signup.executive")}</div>
                  <div className="text-xs text-mine-400">{t("signup.executiveDesc")}</div>
                </div>
              </label>
            </div>
          </div>
          {error && <div className="text-danger-400 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className={`${buttonPrimary} w-full`}>
            {loading ? t("signup.creatingAccount") : t("signup.createAccount")}
          </button>
          <div className="text-xs text-mine-400 pt-2 border-t border-mine-800 text-center">
            {t("signup.alreadyHaveAccount")}{" "}
            <Link to="/login" className="text-mine-300 underline hover:text-mine-100">
              {t("signup.signIn")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
