import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { Sensor } from "../../api/types";
import { CyberTheme, cyberButtonDanger, cyberButtonPrimary, cyberButtonSecondary, cyberLinkButton } from "./cyberTheme";
import CyberTable, { CyberTableColumn } from "./CyberTable";
import CyberModal from "./CyberModal";

// Where a unit is in the provisioning pipeline, derived rather than stored — the underlying
// facts (has an IP, has a key, when it last reported) already live on the sensor, and a
// persisted status column would just be a second copy of them that drifts.
type ProvisioningState = "NOT_NETWORKED" | "AWAITING_KEY" | "NEVER_REPORTED" | "LIVE" | "IDLE" | "STALE";

const STATE_COLORS: Record<ProvisioningState, string> = {
  NOT_NETWORKED: "bg-slate-400",
  AWAITING_KEY: "bg-amber-500",
  NEVER_REPORTED: "bg-orange-500",
  LIVE: "bg-green-600",
  IDLE: "bg-blue-500",
  STALE: "bg-red-600",
};

const HOUR_MS = 60 * 60 * 1000;

function provisioningState(sensor: Sensor): ProvisioningState {
  if (!sensor.ipAddress) return "NOT_NETWORKED";
  if (!sensor.hasApiKey) return "AWAITING_KEY";
  if (!sensor.apiKeyLastUsedAt) return "NEVER_REPORTED";
  const age = Date.now() - new Date(sensor.apiKeyLastUsedAt).getTime();
  if (age < HOUR_MS) return "LIVE";
  if (age < 24 * HOUR_MS) return "IDLE";
  return "STALE";
}

function StatePill({ state }: { state: ProvisioningState }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white whitespace-nowrap ${STATE_COLORS[state]}`}>
      {t(`cyber.sensorSetup.states.${state}`)}
    </span>
  );
}

function relativeTime(iso: string | null | undefined, t: (k: string, o?: any) => string): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t("cyber.sensorSetup.justNow");
  if (mins < 60) return t("cyber.sensorSetup.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("cyber.sensorSetup.hoursAgo", { count: hours });
  return t("cyber.sensorSetup.daysAgo", { count: Math.floor(hours / 24) });
}

type SnippetLang = "curl" | "python" | "powershell";

function buildSnippet(lang: SnippetLang, url: string, key: string): string {
  switch (lang) {
    case "curl":
      return [
        `curl -X POST ${url} \\`,
        `  -H "X-Sensor-Api-Key: ${key}" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d '{"value": 1.4}'`,
      ].join("\n");
    case "python":
      return [
        `import requests`,
        ``,
        `requests.post(`,
        `    "${url}",`,
        `    headers={"X-Sensor-Api-Key": "${key}"},`,
        `    json={"value": read_sensor()},`,
        `    timeout=10,`,
        `)`,
      ].join("\n");
    case "powershell":
      return [
        `Invoke-RestMethod -Method Post \``,
        `  -Uri "${url}" \``,
        `  -Headers @{ "X-Sensor-Api-Key" = "${key}" } \``,
        `  -ContentType "application/json" \``,
        `  -Body '{"value": 1.4}'`,
      ].join("\n");
  }
}

function CopyBlock({ theme, text, label }: { theme: CyberTheme; text: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the text stays selectable on screen either way.
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-semibold ${theme.subtext}`}>{label}</span>
        <button type="button" className={cyberLinkButton(theme)} onClick={copy}>
          {copied ? t("cyber.sensorSetup.copied") : t("cyber.sensorSetup.copy")}
        </button>
      </div>
      <pre className={`text-[11px] font-mono whitespace-pre-wrap break-all rounded-md px-3 py-2 ${theme.dark ? "bg-black/40 text-white/80" : "bg-slate-100 text-slate-800"}`}>
        {text}
      </pre>
    </div>
  );
}

function ProvisioningModal({ theme, sensor, onClose, onChanged }: {
  theme: CyberTheme;
  sensor: Sensor;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [lang, setLang] = useState<SnippetLang>("curl");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = `${API_URL}/api/sensor-ingest/${sensor.id}/readings`;
  // Before a key is issued this session the real value is unknown — only its hash is
  // stored — so the snippet carries a placeholder rather than implying a retrievable key.
  const keyForSnippet = issuedKey ?? "<SENSOR_KEY>";
  const state = provisioningState(sensor);
  const ipMismatch = !!sensor.ipAddress && !!sensor.lastSeenIp && sensor.lastSeenIp !== sensor.ipAddress;

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ key: string }>(`/sensors/${sensor.id}/api-key`);
      setIssuedKey(res.data.key);
      await onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("cyber.sensorSetup.keyError"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm(t("cyber.sensorSetup.confirmRevoke"))) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/sensors/${sensor.id}/api-key`);
      setIssuedKey(null);
      await onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("cyber.sensorSetup.keyError"));
    } finally {
      setBusy(false);
    }
  }

  const rowLabel = `text-[11px] ${theme.mutedText}`;

  return (
    <CyberModal theme={theme} title={`${sensor.name} — ${t("cyber.sensorSetup.provisionTitle")}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className={rowLabel}>{t("cyber.sensorSetup.colState")}</div>
            <div className="mt-1"><StatePill state={state} /></div>
          </div>
          <div>
            <div className={rowLabel}>{t("cyber.sensorSetup.colIp")}</div>
            <div className={`mt-1 text-xs font-mono ${theme.text}`}>{sensor.ipAddress || "—"}</div>
          </div>
          <div>
            <div className={rowLabel}>{t("cyber.sensorSetup.colLastCheckIn")}</div>
            <div className={`mt-1 text-xs ${theme.text}`}>{relativeTime(sensor.apiKeyLastUsedAt, t)}</div>
          </div>
          <div>
            <div className={rowLabel}>{t("cyber.sensorSetup.seenFrom")}</div>
            <div className={`mt-1 text-xs font-mono ${ipMismatch ? "text-amber-500 font-semibold" : theme.text}`}>{sensor.lastSeenIp || "—"}</div>
          </div>
        </div>

        {ipMismatch && (
          <div className="text-[11px] text-amber-500 border border-amber-500/40 bg-amber-500/10 rounded-md px-3 py-2">
            {t("cyber.sensorSetup.ipMismatchWarning", { registered: sensor.ipAddress, actual: sensor.lastSeenIp })}
          </div>
        )}

        {!sensor.ipAddress && (
          <div className={`text-[11px] border rounded-md px-3 py-2 ${theme.dark ? "border-white/15 text-white/60" : "border-slate-300 text-slate-600"}`}>
            {t("cyber.sensorSetup.noIpWarning")}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`text-xs font-semibold ${theme.text}`}>{t("cyber.sensorSetup.stepKey")}</span>
            <div className="flex gap-2">
              {sensor.hasApiKey && (
                <button type="button" className={cyberButtonDanger} onClick={revoke} disabled={busy}>{t("cyber.sensorSetup.revoke")}</button>
              )}
              <button type="button" className={cyberButtonPrimary} onClick={issue} disabled={busy}>
                {busy ? t("common.saving") : sensor.hasApiKey ? t("cyber.sensorSetup.rotate") : t("cyber.sensorSetup.generate")}
              </button>
            </div>
          </div>

          {issuedKey ? (
            <div className="border border-hazard-500/40 bg-hazard-500/10 rounded-md px-3 py-2 space-y-2">
              <div className="text-[11px] font-semibold text-hazard-500">{t("cyber.sensorSetup.shownOnce")}</div>
              <code className={`block text-[11px] font-mono break-all ${theme.text}`}>{issuedKey}</code>
            </div>
          ) : (
            <p className={`text-[11px] ${theme.mutedText}`}>
              {sensor.hasApiKey ? t("cyber.sensorSetup.keyIssuedHint") : t("cyber.sensorSetup.noKeyHint")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <span className={`text-xs font-semibold ${theme.text}`}>{t("cyber.sensorSetup.stepConfigure")}</span>
          <div className="flex gap-1">
            {(["curl", "python", "powershell"] as SnippetLang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                  lang === l ? "bg-hazard-500 text-white" : theme.dark ? "text-white/50 hover:text-white/80" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t(`cyber.sensorSetup.lang.${l}`)}
              </button>
            ))}
          </div>
          <CopyBlock theme={theme} text={buildSnippet(lang, url, keyForSnippet)} label={t("cyber.sensorSetup.snippetLabel")} />
          <CopyBlock theme={theme} text={url} label={t("cyber.sensorSetup.endpointLabel")} />
        </div>

        {error && <div className="text-xs text-danger-500">{error}</div>}

        <div className="flex justify-end">
          <button type="button" className={cyberButtonSecondary(theme)} onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </CyberModal>
  );
}

type Filter = "all" | "needsSetup" | "reporting" | "notNetworked";

export default function SensorProvisioningTab({ theme, canEdit }: { theme: CyberTheme; canEdit: boolean }) {
  const { t } = useTranslation();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [provisioning, setProvisioning] = useState<Sensor | null>(null);

  async function load() {
    try {
      const res = await api.get<Sensor[]>("/sensors");
      setSensors(res.data);
      // Keep an open panel pointed at the refreshed row, so it reflects a key that was
      // just issued or revoked rather than the snapshot it was opened with.
      setProvisioning((current) => (current ? res.data.find((s) => s.id === current.id) ?? null : null));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const networked = sensors.filter((s) => s.ipAddress);
    return {
      networked: networked.length,
      awaitingKey: networked.filter((s) => !s.hasApiKey).length,
      neverReported: networked.filter((s) => s.hasApiKey && !s.apiKeyLastUsedAt).length,
      stale: networked.filter((s) => provisioningState(s) === "STALE").length,
    };
  }, [sensors]);

  const rows = useMemo(() => {
    switch (filter) {
      case "needsSetup":
        return sensors.filter((s) => {
          const state = provisioningState(s);
          return state === "AWAITING_KEY" || state === "NEVER_REPORTED" || state === "STALE";
        });
      case "reporting":
        return sensors.filter((s) => ["LIVE", "IDLE"].includes(provisioningState(s)));
      case "notNetworked":
        return sensors.filter((s) => !s.ipAddress);
      default:
        return sensors;
    }
  }, [sensors, filter]);

  if (loading) return <div className={theme.subtext}>{t("common.loading")}</div>;

  const columns: CyberTableColumn<Sensor>[] = [
    {
      key: "name",
      header: t("cyber.sensorSetup.colSensor"),
      render: (s) => (
        <div>
          <div className={`font-semibold ${theme.text}`}>{s.name}</div>
          <div className={theme.mutedText}>{t(`sensors.types.${s.type}`)}</div>
        </div>
      ),
      sortValue: (s) => s.name,
    },
    { key: "zone", header: t("cyber.sensorSetup.colZone"), render: (s) => s.zone?.name ?? "—", sortValue: (s) => s.zone?.name ?? "" },
    {
      key: "ip",
      header: t("cyber.sensorSetup.colIp"),
      render: (s) => (s.ipAddress ? <span className="font-mono">{s.ipAddress}</span> : <span className={theme.mutedText}>—</span>),
      sortValue: (s) => s.ipAddress ?? "",
    },
    {
      key: "state",
      header: t("cyber.sensorSetup.colState"),
      render: (s) => <StatePill state={provisioningState(s)} />,
      sortValue: (s) => provisioningState(s),
    },
    {
      key: "lastCheckIn",
      header: t("cyber.sensorSetup.colLastCheckIn"),
      render: (s) => relativeTime(s.apiKeyLastUsedAt, t),
      sortValue: (s) => s.apiKeyLastUsedAt ?? "",
    },
    {
      key: "seenFrom",
      header: t("cyber.sensorSetup.seenFrom"),
      render: (s) => {
        if (!s.lastSeenIp) return <span className={theme.mutedText}>—</span>;
        const mismatch = !!s.ipAddress && s.lastSeenIp !== s.ipAddress;
        return (
          <span className={`font-mono ${mismatch ? "text-amber-500 font-semibold" : ""}`} title={mismatch ? t("cyber.sensorSetup.ipMismatchShort") ?? "" : undefined}>
            {s.lastSeenIp}
            {mismatch && " ⚠"}
          </span>
        );
      },
      sortValue: (s) => s.lastSeenIp ?? "",
    },
  ];

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("cyber.sensorSetup.filterAll"), count: sensors.length },
    { key: "needsSetup", label: t("cyber.sensorSetup.filterNeedsSetup"), count: stats.awaitingKey + stats.neverReported + stats.stale },
    { key: "reporting", label: t("cyber.sensorSetup.filterReporting"), count: sensors.filter((s) => ["LIVE", "IDLE"].includes(provisioningState(s))).length },
    { key: "notNetworked", label: t("cyber.sensorSetup.filterNotNetworked"), count: sensors.length - stats.networked },
  ];

  const statCards = [
    { label: t("cyber.sensorSetup.statNetworked"), value: stats.networked, tone: "" },
    { label: t("cyber.sensorSetup.statAwaitingKey"), value: stats.awaitingKey, tone: stats.awaitingKey > 0 ? "text-amber-500" : "" },
    { label: t("cyber.sensorSetup.statNeverReported"), value: stats.neverReported, tone: stats.neverReported > 0 ? "text-orange-500" : "" },
    { label: t("cyber.sensorSetup.statStale"), value: stats.stale, tone: stats.stale > 0 ? "text-red-500" : "" },
  ];

  return (
    <div className="space-y-4">
      <p className={`text-xs ${theme.subtext}`}>{t("cyber.sensorSetup.intro")}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className={`${theme.panel} px-4 py-3`}>
            <div className={`text-[11px] uppercase tracking-wide ${theme.mutedText}`}>{card.label}</div>
            <div className={`text-2xl font-bold mt-0.5 ${card.tone || theme.text}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <CyberTable
        theme={theme}
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        emptyMessage={t("cyber.sensorSetup.empty")}
        searchValue={(s) => `${s.name} ${s.ipAddress ?? ""} ${s.zone?.name ?? ""}`}
        toolbarExtra={
          <div className="flex gap-1 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                  filter === f.key ? "bg-hazard-500 text-white" : theme.dark ? "text-white/50 hover:text-white/80" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        }
        actions={(s) =>
          canEdit ? (
            <button className={cyberLinkButton(theme)} onClick={() => setProvisioning(s)}>
              {s.hasApiKey ? t("cyber.sensorSetup.manage") : t("cyber.sensorSetup.provision")}
            </button>
          ) : null
        }
      />

      {provisioning && (
        <ProvisioningModal theme={theme} sensor={provisioning} onClose={() => setProvisioning(null)} onChanged={load} />
      )}
    </div>
  );
}
