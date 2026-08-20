import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { CyberSystemSetting } from "../../api/types";
import { CyberTheme, cyberButtonDanger, cyberButtonPrimary, cyberButtonSecondary } from "./cyberTheme";
import CyberModal from "./CyberModal";

const SOURCE_STYLES: Record<CyberSystemSetting["source"], string> = {
  database: "bg-green-600 text-white",
  environment: "bg-blue-500 text-white",
  default: "bg-slate-400 text-white",
  unset: "bg-slate-400 text-white",
};

function EditSettingForm({
  theme,
  setting,
  onSubmit,
  onCancel,
}: {
  theme: CyberTheme;
  setting: CyberSystemSetting;
  onSubmit: (value: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(setting.type === "boolean" ? setting.maskedValue ?? "false" : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("cyber.settings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className={`text-xs ${theme.mutedText}`}>{setting.description}</p>
      {setting.maskedValue && (
        <p className={`text-xs ${theme.subtext}`}>
          {t("cyber.settings.currentValue")}: <span className={theme.text}>{setting.maskedValue}</span>
        </p>
      )}
      <div>
        <label className={`block text-xs font-semibold mb-1 ${theme.subtext}`}>{t("cyber.settings.newValue")}</label>
        {setting.type === "boolean" ? (
          <select className={theme.select} value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="false">{t("cyber.settings.off")}</option>
            <option value="true">{t("cyber.settings.on")}</option>
          </select>
        ) : (
          <input
            className={theme.input}
            type={setting.type === "password" ? "password" : setting.type === "number" ? "number" : "text"}
            min={setting.type === "number" ? 1 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            required
          />
        )}
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={cyberButtonSecondary(theme)} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={cyberButtonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function SettingsTab({ theme, canEdit }: { theme: CyberTheme; canEdit: boolean }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<CyberSystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CyberSystemSetting | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<CyberSystemSetting[]>("/cyber-settings");
      setSettings(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(key: string, value: string) {
    await api.put(`/cyber-settings/${key}`, { value });
    setEditing(null);
    setTestResults((r) => ({ ...r, [key]: undefined as any }));
    await load();
  }

  async function resetToEnvironment(key: string) {
    if (!confirm(t("cyber.settings.confirmReset"))) return;
    setBusyKey(key);
    try {
      await api.delete(`/cyber-settings/${key}`);
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  async function testConnection(key: string) {
    setBusyKey(key);
    try {
      const res = await api.post<{ success: boolean; message: string }>(`/cyber-settings/${key}/test`);
      setTestResults((r) => ({ ...r, [key]: res.data }));
    } catch (err: any) {
      setTestResults((r) => ({ ...r, [key]: { success: false, message: err.response?.data?.error ?? t("cyber.settings.testError") } }));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <div className={theme.subtext}>{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.settings.title")}</h3>
        <p className={`text-xs ${theme.mutedText}`}>{t("cyber.settings.hint")}</p>
      </div>

      <div className="space-y-2">
        {settings.map((s) => {
          const result = testResults[s.key];
          return (
            <div key={s.key} className={`${theme.panel} p-3 flex items-start justify-between gap-3 flex-wrap`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${theme.text}`}>{s.label}</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${SOURCE_STYLES[s.source]}`}>
                    {t(`cyber.settings.source.${s.source}`)}
                  </span>
                </div>
                <p className={`text-[11px] mt-0.5 ${theme.mutedText}`}>{s.description}</p>
                <p className={`text-xs mt-1 ${theme.subtext}`}>
                  {s.maskedValue ?? t("cyber.settings.notSet")}
                  {s.updatedByName && (
                    <span className={`ml-2 text-[10px] ${theme.mutedText}`}>
                      {t("cyber.settings.updatedBy", { name: s.updatedByName, date: s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "" })}
                    </span>
                  )}
                </p>
                {result && (
                  <p className={`text-xs mt-1.5 font-semibold ${result.success ? "text-green-500" : "text-red-500"}`}>
                    {result.success ? t("cyber.settings.testSuccess") : t("cyber.settings.testFailed")}: {result.message}
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2 shrink-0">
                  {s.testable && (
                    <button className={cyberButtonSecondary(theme)} disabled={busyKey === s.key} onClick={() => testConnection(s.key)}>
                      {busyKey === s.key ? t("cyber.settings.testing") : t("cyber.settings.testConnection")}
                    </button>
                  )}
                  <button className={cyberButtonSecondary(theme)} onClick={() => setEditing(s)}>{t("cyber.settings.edit")}</button>
                  {s.source === "database" && (
                    <button className={cyberButtonDanger} disabled={busyKey === s.key} onClick={() => resetToEnvironment(s.key)}>
                      {t("cyber.settings.clearOverride")}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <CyberModal theme={theme} title={editing.label} onClose={() => setEditing(null)}>
          <EditSettingForm theme={theme} setting={editing} onSubmit={(value) => save(editing.key, value)} onCancel={() => setEditing(null)} />
        </CyberModal>
      )}
    </div>
  );
}
