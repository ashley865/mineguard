import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { Sensor, SensorAgent, SensorPollProtocol } from "../../api/types";
import { CyberTheme, cyberButtonDanger, cyberButtonPrimary, cyberButtonSecondary, cyberLinkButton } from "./cyberTheme";
import CyberTable, { CyberTableColumn } from "./CyberTable";
import CyberModal from "./CyberModal";

// How a sensor's readings actually arrive. Derived from the sensor's own fields rather
// than stored, so there's no separate mode flag to fall out of step with the config.
type CollectionMode = "PUSH" | "SERVER_POLL" | "AGENT_POLL" | "NONE";

function collectionMode(sensor: Sensor): CollectionMode {
  if (sensor.pollEnabled && sensor.pollAgentId) return "AGENT_POLL";
  if (sensor.pollEnabled) return "SERVER_POLL";
  if (sensor.hasApiKey) return "PUSH";
  return "NONE";
}

type ProvisioningState = "UNCONFIGURED" | "AWAITING_KEY" | "NEVER_REPORTED" | "LIVE" | "IDLE" | "STALE" | "FAILING";

const STATE_COLORS: Record<ProvisioningState, string> = {
  UNCONFIGURED: "bg-slate-400",
  AWAITING_KEY: "bg-amber-500",
  NEVER_REPORTED: "bg-orange-500",
  LIVE: "bg-green-600",
  IDLE: "bg-blue-500",
  STALE: "bg-red-600",
  FAILING: "bg-red-600",
};

const HOUR_MS = 60 * 60 * 1000;

function provisioningState(sensor: Sensor): ProvisioningState {
  const mode = collectionMode(sensor);
  if (mode === "NONE") return "UNCONFIGURED";
  // A poll that ran and failed is a louder problem than one that has simply gone quiet:
  // the collector reached its scheduled attempt and the instrument refused it.
  if (sensor.pollEnabled && sensor.lastPollOk === false) return "FAILING";
  if (mode === "PUSH" && !sensor.hasApiKey) return "AWAITING_KEY";

  const lastSeen = sensor.pollEnabled ? sensor.lastPollAt : sensor.apiKeyLastUsedAt;
  if (!lastSeen) return "NEVER_REPORTED";
  const age = Date.now() - new Date(lastSeen).getTime();
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
      return `curl -X POST ${url} \\\n  -H "X-Sensor-Api-Key: ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"value": 1.4}'`;
    case "python":
      return `import requests\n\nrequests.post(\n    "${url}",\n    headers={"X-Sensor-Api-Key": "${key}"},\n    json={"value": read_sensor()},\n    timeout=10,\n)`;
    case "powershell":
      return `Invoke-RestMethod -Method Post \`\n  -Uri "${url}" \`\n  -Headers @{ "X-Sensor-Api-Key" = "${key}" } \`\n  -ContentType "application/json" \`\n  -Body '{"value": 1.4}'`;
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

/** Per-protocol read instructions. Field names match what the collectors expect. */
function PollConfigFields({ theme, protocol, config, onChange }: {
  theme: CyberTheme;
  protocol: SensorPollProtocol;
  config: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const { t } = useTranslation();
  const label = `block text-[11px] font-semibold mb-1 ${theme.subtext}`;
  const set = (key: string, value: any) => onChange({ ...config, [key]: value });

  if (protocol === "HTTP_JSON") {
    return (
      <div>
        <label className={label}>{t("cyber.sensorSetup.jsonPath")}</label>
        <input className={theme.input} value={config.jsonPath ?? ""} onChange={(e) => set("jsonPath", e.target.value)} placeholder="data.value" />
        <p className={`text-[10px] mt-1 ${theme.mutedText}`}>{t("cyber.sensorSetup.jsonPathHint")}</p>
      </div>
    );
  }

  if (protocol === "MODBUS_TCP") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.sensorSetup.unitId")}</label>
          <input className={theme.input} type="number" min={0} max={247} value={config.unitId ?? 1} onChange={(e) => set("unitId", Number(e.target.value))} />
        </div>
        <div>
          <label className={label}>{t("cyber.sensorSetup.register")}</label>
          <input className={theme.input} type="number" min={0} value={config.register ?? ""} onChange={(e) => set("register", Number(e.target.value))} required />
        </div>
        <div>
          <label className={label}>{t("cyber.sensorSetup.registerType")}</label>
          <select className={theme.select} value={config.registerType ?? "HOLDING"} onChange={(e) => set("registerType", e.target.value)}>
            <option value="HOLDING">{t("cyber.sensorSetup.holding")}</option>
            <option value="INPUT">{t("cyber.sensorSetup.input")}</option>
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.sensorSetup.wordCount")}</label>
          <select className={theme.select} value={config.wordCount ?? 1} onChange={(e) => set("wordCount", Number(e.target.value))}>
            <option value={1}>{t("cyber.sensorSetup.word16")}</option>
            <option value={2}>{t("cyber.sensorSetup.word32")}</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className={label}>{t("cyber.sensorSetup.scale")}</label>
          <input className={theme.input} type="number" step="any" value={config.scale ?? 1} onChange={(e) => set("scale", Number(e.target.value))} />
          <p className={`text-[10px] mt-1 ${theme.mutedText}`}>{t("cyber.sensorSetup.scaleHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className={label}>{t("cyber.sensorSetup.oid")}</label>
        <input className={theme.input} value={config.oid ?? ""} onChange={(e) => set("oid", e.target.value)} placeholder="1.3.6.1.4.1.1.2.1" required />
      </div>
      <div>
        <label className={label}>{t("cyber.sensorSetup.community")}</label>
        <input className={theme.input} value={config.community ?? "public"} onChange={(e) => set("community", e.target.value)} />
      </div>
      <div>
        <label className={label}>{t("cyber.sensorSetup.snmpVersion")}</label>
        <select className={theme.select} value={config.version ?? "v2c"} onChange={(e) => set("version", e.target.value)}>
          <option value="v2c">v2c</option>
          <option value="v1">v1</option>
        </select>
      </div>
      <div className="col-span-2">
        <label className={label}>{t("cyber.sensorSetup.scale")}</label>
        <input className={theme.input} type="number" step="any" value={config.scale ?? 1} onChange={(e) => set("scale", Number(e.target.value))} />
      </div>
    </div>
  );
}

function ProvisioningModal({ theme, sensor, agents, onClose, onChanged }: {
  theme: CyberTheme;
  sensor: Sensor;
  agents: SensorAgent[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CollectionMode>(() => {
    const current = collectionMode(sensor);
    return current === "NONE" ? "PUSH" : current;
  });
  const [protocol, setProtocol] = useState<SensorPollProtocol>(sensor.pollProtocol ?? "HTTP_JSON");
  const [target, setTarget] = useState(sensor.pollTarget ?? "");
  const [config, setConfig] = useState<Record<string, any>>((sensor.pollConfig as Record<string, any>) ?? {});
  const [intervalSeconds, setIntervalSeconds] = useState(String(sensor.pollIntervalSeconds ?? 60));
  const [agentId, setAgentId] = useState(sensor.pollAgentId ?? agents[0]?.id ?? "");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [lang, setLang] = useState<SnippetLang>("curl");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const url = `${API_URL}/api/sensor-ingest/${sensor.id}/readings`;
  const keyForSnippet = issuedKey ?? "<SENSOR_KEY>";
  const state = provisioningState(sensor);
  const ipMismatch = !!sensor.ipAddress && !!sensor.lastSeenIp && sensor.lastSeenIp !== sensor.ipAddress;
  const label = `block text-[11px] font-semibold mb-1 ${theme.subtext}`;

  // Server-side polling can only ever be HTTP: this API is cloud-hosted with no route to a
  // mine LAN, and Modbus/SNMP have no business crossing the internet.
  const availableProtocols: SensorPollProtocol[] = mode === "SERVER_POLL" ? ["HTTP_JSON"] : ["HTTP_JSON", "MODBUS_TCP", "SNMP"];
  const effectiveProtocol = availableProtocols.includes(protocol) ? protocol : "HTTP_JSON";

  async function issueKey() {
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

  async function revokeKey() {
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

  async function savePolling(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      await api.put(`/sensors/${sensor.id}`, {
        pollEnabled: true,
        pollProtocol: effectiveProtocol,
        pollTarget: target,
        pollConfig: config,
        pollIntervalSeconds: Number(intervalSeconds),
        pollAgentId: mode === "AGENT_POLL" ? agentId : null,
      });
      await onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("cyber.sensorSetup.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function disablePolling() {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/sensors/${sensor.id}`, { pollEnabled: false });
      await onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("cyber.sensorSetup.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function testPoll() {
    setBusy(true);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>(`/sensors/${sensor.id}/test-poll`);
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.error ?? t("cyber.sensorSetup.testFailed") });
    } finally {
      setBusy(false);
    }
  }

  const modes: { key: CollectionMode; label: string; hint: string }[] = [
    { key: "PUSH", label: t("cyber.sensorSetup.modePush"), hint: t("cyber.sensorSetup.modePushHint") },
    { key: "SERVER_POLL", label: t("cyber.sensorSetup.modeServer"), hint: t("cyber.sensorSetup.modeServerHint") },
    { key: "AGENT_POLL", label: t("cyber.sensorSetup.modeAgent"), hint: t("cyber.sensorSetup.modeAgentHint") },
  ];

  return (
    <CyberModal theme={theme} title={`${sensor.name} — ${t("cyber.sensorSetup.provisionTitle")}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className={`text-[11px] ${theme.mutedText}`}>{t("cyber.sensorSetup.colState")}</div>
            <div className="mt-1"><StatePill state={state} /></div>
          </div>
          <div>
            <div className={`text-[11px] ${theme.mutedText}`}>{t("cyber.sensorSetup.colIp")}</div>
            <div className={`mt-1 text-xs font-mono ${theme.text}`}>{sensor.ipAddress || "—"}</div>
          </div>
          <div>
            <div className={`text-[11px] ${theme.mutedText}`}>{t("cyber.sensorSetup.colLastCheckIn")}</div>
            <div className={`mt-1 text-xs ${theme.text}`}>{relativeTime(sensor.pollEnabled ? sensor.lastPollAt : sensor.apiKeyLastUsedAt, t)}</div>
          </div>
          <div>
            <div className={`text-[11px] ${theme.mutedText}`}>{t("cyber.sensorSetup.seenFrom")}</div>
            <div className={`mt-1 text-xs font-mono ${ipMismatch ? "text-amber-500 font-semibold" : theme.text}`}>{sensor.lastSeenIp || "—"}</div>
          </div>
        </div>

        {sensor.lastPollError && (
          <div className="text-[11px] text-red-400 border border-red-500/40 bg-red-500/10 rounded-md px-3 py-2">
            {t("cyber.sensorSetup.lastError", { error: sensor.lastPollError })}
          </div>
        )}

        {ipMismatch && (
          <div className="text-[11px] text-amber-500 border border-amber-500/40 bg-amber-500/10 rounded-md px-3 py-2">
            {t("cyber.sensorSetup.ipMismatchWarning", { registered: sensor.ipAddress, actual: sensor.lastSeenIp })}
          </div>
        )}

        <div className="space-y-2">
          <span className={`text-xs font-semibold ${theme.text}`}>{t("cyber.sensorSetup.stepMode")}</span>
          <div className="grid sm:grid-cols-3 gap-2">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => { setMode(m.key); setTestResult(null); }}
                className={`text-left rounded-md border px-3 py-2 transition-colors ${
                  mode === m.key
                    ? "border-hazard-500 bg-hazard-500/10"
                    : theme.dark
                    ? "border-white/15 hover:border-white/30"
                    : "border-slate-300 hover:border-slate-400"
                }`}
              >
                <div className={`text-[11px] font-semibold ${theme.text}`}>{m.label}</div>
                <div className={`text-[10px] mt-0.5 ${theme.mutedText}`}>{m.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {mode === "PUSH" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`text-xs font-semibold ${theme.text}`}>{t("cyber.sensorSetup.stepKey")}</span>
              <div className="flex gap-2">
                {sensor.hasApiKey && <button type="button" className={cyberButtonDanger} onClick={revokeKey} disabled={busy}>{t("cyber.sensorSetup.revoke")}</button>}
                <button type="button" className={cyberButtonPrimary} onClick={issueKey} disabled={busy}>
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

            <div className="space-y-2">
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
            </div>
          </div>
        ) : (
          <form onSubmit={savePolling} className="space-y-3">
            <span className={`text-xs font-semibold ${theme.text}`}>{t("cyber.sensorSetup.stepPoll")}</span>

            {mode === "AGENT_POLL" && (
              agents.length === 0 ? (
                <div className={`text-[11px] border rounded-md px-3 py-2 ${theme.dark ? "border-white/15 text-white/60" : "border-slate-300 text-slate-600"}`}>
                  {t("cyber.sensorSetup.noAgentsWarning")}
                </div>
              ) : (
                <div>
                  <label className={label}>{t("cyber.sensorSetup.agent")}</label>
                  <select className={theme.select} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{t("cyber.sensorSetup.protocol")}</label>
                <select className={theme.select} value={effectiveProtocol} onChange={(e) => { setProtocol(e.target.value as SensorPollProtocol); setConfig({}); }}>
                  {availableProtocols.map((p) => <option key={p} value={p}>{t(`cyber.sensorSetup.protocols.${p}`)}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>{t("cyber.sensorSetup.interval")}</label>
                <input className={theme.input} type="number" min={10} max={86400} value={intervalSeconds} onChange={(e) => setIntervalSeconds(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className={label}>{t("cyber.sensorSetup.target")}</label>
              <input
                className={theme.input}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={effectiveProtocol === "HTTP_JSON" ? "http://192.168.10.42/api/reading" : effectiveProtocol === "MODBUS_TCP" ? "192.168.10.50:502" : "192.168.10.60"}
                required
              />
              <p className={`text-[10px] mt-1 ${theme.mutedText}`}>{t(`cyber.sensorSetup.targetHint.${effectiveProtocol}`)}</p>
            </div>

            <PollConfigFields theme={theme} protocol={effectiveProtocol} config={config} onChange={setConfig} />

            {testResult && (
              <div className={`text-[11px] rounded-md px-3 py-2 border ${testResult.success ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-red-500/40 bg-red-500/10 text-red-400"}`}>
                {testResult.message}
              </div>
            )}

            <div className="flex justify-end gap-2 flex-wrap">
              {sensor.pollEnabled && <button type="button" className={cyberButtonDanger} onClick={disablePolling} disabled={busy}>{t("cyber.sensorSetup.disablePolling")}</button>}
              {mode === "SERVER_POLL" && sensor.pollEnabled && (
                <button type="button" className={cyberButtonSecondary(theme)} onClick={testPoll} disabled={busy}>{t("cyber.sensorSetup.testPoll")}</button>
              )}
              <button type="submit" className={cyberButtonPrimary} disabled={busy || (mode === "AGENT_POLL" && agents.length === 0)}>
                {busy ? t("common.saving") : t("cyber.sensorSetup.savePolling")}
              </button>
            </div>
            {mode === "SERVER_POLL" && !sensor.pollEnabled && (
              <p className={`text-[10px] ${theme.mutedText}`}>{t("cyber.sensorSetup.testAfterSaveHint")}</p>
            )}
          </form>
        )}

        {error && <div className="text-xs text-danger-500">{error}</div>}
      </div>
    </CyberModal>
  );
}

function AgentsView({ theme, agents, canEdit, onChanged }: {
  theme: CyberTheme;
  agents: SensorAgent[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ key: string }>("/sensor-agents", { name });
      setIssuedKey(res.data.key);
      setName("");
      setCreating(false);
      await onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("cyber.sensorSetup.agentError"));
    } finally {
      setBusy(false);
    }
  }

  async function rotate(agent: SensorAgent) {
    if (!confirm(t("cyber.sensorSetup.confirmRotateAgent"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ key: string }>(`/sensor-agents/${agent.id}/api-key`);
      setIssuedKey(res.data.key);
      await onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("cyber.sensorSetup.agentError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(agent: SensorAgent) {
    if (!confirm(t("cyber.sensorSetup.confirmDeleteAgent"))) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/sensor-agents/${agent.id}`);
      await onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("cyber.sensorSetup.agentError"));
    } finally {
      setBusy(false);
    }
  }

  const columns: CyberTableColumn<SensorAgent>[] = [
    { key: "name", header: t("cyber.sensorSetup.agentName"), render: (a) => <span className={`font-semibold ${theme.text}`}>{a.name}</span>, sortValue: (a) => a.name },
    { key: "sensors", header: t("cyber.sensorSetup.agentSensors"), render: (a) => a.sensorCount, sortValue: (a) => a.sensorCount },
    { key: "version", header: t("cyber.sensorSetup.agentVersion"), render: (a) => a.agentVersion ?? "—", sortValue: (a) => a.agentVersion ?? "" },
    { key: "lastSeen", header: t("cyber.sensorSetup.agentLastSeen"), render: (a) => relativeTime(a.lastSeenAt, t), sortValue: (a) => a.lastSeenAt ?? "" },
    { key: "ip", header: t("cyber.sensorSetup.seenFrom"), render: (a) => (a.lastSeenIp ? <span className="font-mono">{a.lastSeenIp}</span> : <span className={theme.mutedText}>—</span>), sortValue: (a) => a.lastSeenIp ?? "" },
  ];

  return (
    <div className="space-y-3">
      <p className={`text-xs ${theme.subtext}`}>{t("cyber.sensorSetup.agentsIntro")}</p>

      {issuedKey && (
        <div className="border border-hazard-500/40 bg-hazard-500/10 rounded-md px-3 py-3 space-y-2">
          <div className="text-[11px] font-semibold text-hazard-500">{t("cyber.sensorSetup.agentKeyShownOnce")}</div>
          <code className={`block text-[11px] font-mono break-all ${theme.text}`}>{issuedKey}</code>
          <CopyBlock
            theme={theme}
            label={t("cyber.sensorSetup.agentRunLabel")}
            text={`MINEGUARD_API_URL=${API_URL} \\\nMINEGUARD_AGENT_KEY=${issuedKey} \\\nnode index.js`}
          />
          <button type="button" className={cyberButtonSecondary(theme)} onClick={() => setIssuedKey(null)}>{t("cyber.sensorSetup.dismissKey")}</button>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          {creating ? (
            <form onSubmit={create} className="flex gap-2 items-center">
              <input className={`${theme.input} max-w-xs`} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("cyber.sensorSetup.agentNamePlaceholder") ?? ""} required autoFocus />
              <button type="submit" className={cyberButtonPrimary} disabled={busy}>{busy ? t("common.saving") : t("common.save")}</button>
              <button type="button" className={cyberButtonSecondary(theme)} onClick={() => setCreating(false)}>{t("common.cancel")}</button>
            </form>
          ) : (
            <button className={cyberButtonPrimary} onClick={() => setCreating(true)}>{t("cyber.sensorSetup.newAgent")}</button>
          )}
        </div>
      )}

      {error && <div className="text-xs text-danger-500">{error}</div>}

      <CyberTable
        theme={theme}
        columns={columns}
        rows={agents}
        rowKey={(a) => a.id}
        emptyMessage={t("cyber.sensorSetup.noAgents")}
        actions={(a) =>
          canEdit ? (
            <div className="flex justify-end gap-2">
              <button className={cyberLinkButton(theme)} onClick={() => rotate(a)}>{t("cyber.sensorSetup.rotate")}</button>
              <button className={cyberButtonDanger} onClick={() => remove(a)}>{t("common.delete")}</button>
            </div>
          ) : null
        }
      />
    </div>
  );
}

type Filter = "all" | "needsSetup" | "reporting" | "unconfigured";
type View = "sensors" | "agents";

export default function SensorProvisioningTab({ theme, canEdit }: { theme: CyberTheme; canEdit: boolean }) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("sensors");
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [agents, setAgents] = useState<SensorAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [provisioning, setProvisioning] = useState<Sensor | null>(null);

  async function load() {
    try {
      const [sensorsRes, agentsRes] = await Promise.all([
        api.get<Sensor[]>("/sensors"),
        api.get<SensorAgent[]>("/sensor-agents").catch(() => ({ data: [] as SensorAgent[] })),
      ]);
      setSensors(sensorsRes.data);
      setAgents(agentsRes.data);
      // Keep an open panel pointed at the refreshed row, so it reflects what was just saved
      // rather than the snapshot it was opened with.
      setProvisioning((current) => (current ? sensorsRes.data.find((s) => s.id === current.id) ?? null : null));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const collected = sensors.filter((s) => collectionMode(s) !== "NONE");
    return {
      collected: collected.length,
      pushing: sensors.filter((s) => collectionMode(s) === "PUSH").length,
      polling: sensors.filter((s) => s.pollEnabled).length,
      failing: sensors.filter((s) => ["FAILING", "STALE", "NEVER_REPORTED"].includes(provisioningState(s)) && collectionMode(s) !== "NONE").length,
    };
  }, [sensors]);

  const rows = useMemo(() => {
    switch (filter) {
      case "needsSetup":
        return sensors.filter((s) => ["AWAITING_KEY", "NEVER_REPORTED", "STALE", "FAILING"].includes(provisioningState(s)) && collectionMode(s) !== "NONE");
      case "reporting":
        return sensors.filter((s) => ["LIVE", "IDLE"].includes(provisioningState(s)));
      case "unconfigured":
        return sensors.filter((s) => collectionMode(s) === "NONE");
      default:
        return sensors;
    }
  }, [sensors, filter]);

  if (loading) return <div className={theme.subtext}>{t("common.loading")}</div>;

  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

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
      key: "mode",
      header: t("cyber.sensorSetup.colMode"),
      render: (s) => {
        const mode = collectionMode(s);
        if (mode === "NONE") return <span className={theme.mutedText}>—</span>;
        return (
          <div>
            <div className={theme.text}>{t(`cyber.sensorSetup.modes.${mode}`)}</div>
            {mode === "AGENT_POLL" && s.pollAgentId && <div className={theme.mutedText}>{agentNameById.get(s.pollAgentId) ?? "—"}</div>}
            {s.pollEnabled && s.pollProtocol && <div className={theme.mutedText}>{t(`cyber.sensorSetup.protocols.${s.pollProtocol}`)}</div>}
          </div>
        );
      },
      sortValue: (s) => collectionMode(s),
    },
    {
      key: "address",
      header: t("cyber.sensorSetup.colAddress"),
      render: (s) => {
        const addr = s.pollEnabled ? s.pollTarget : s.ipAddress;
        return addr ? <span className="font-mono break-all">{addr}</span> : <span className={theme.mutedText}>—</span>;
      },
      sortValue: (s) => (s.pollEnabled ? s.pollTarget : s.ipAddress) ?? "",
    },
    { key: "state", header: t("cyber.sensorSetup.colState"), render: (s) => <StatePill state={provisioningState(s)} />, sortValue: (s) => provisioningState(s) },
    {
      key: "lastCheckIn",
      header: t("cyber.sensorSetup.colLastCheckIn"),
      render: (s) => relativeTime(s.pollEnabled ? s.lastPollAt : s.apiKeyLastUsedAt, t),
      sortValue: (s) => (s.pollEnabled ? s.lastPollAt : s.apiKeyLastUsedAt) ?? "",
    },
  ];

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("cyber.sensorSetup.filterAll"), count: sensors.length },
    { key: "needsSetup", label: t("cyber.sensorSetup.filterNeedsSetup"), count: stats.failing },
    { key: "reporting", label: t("cyber.sensorSetup.filterReporting"), count: sensors.filter((s) => ["LIVE", "IDLE"].includes(provisioningState(s))).length },
    { key: "unconfigured", label: t("cyber.sensorSetup.filterUnconfigured"), count: sensors.length - stats.collected },
  ];

  const statCards = [
    { label: t("cyber.sensorSetup.statCollected"), value: stats.collected, tone: "" },
    { label: t("cyber.sensorSetup.statPushing"), value: stats.pushing, tone: "" },
    { label: t("cyber.sensorSetup.statPolling"), value: stats.polling, tone: "" },
    { label: t("cyber.sensorSetup.statFailing"), value: stats.failing, tone: stats.failing > 0 ? "text-red-500" : "" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(["sensors", "agents"] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors ${
              view === v ? "bg-hazard-500 text-white" : theme.dark ? "text-white/50 hover:text-white/80" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {v === "sensors" ? t("cyber.sensorSetup.viewSensors") : t("cyber.sensorSetup.viewAgents", { count: agents.length })}
          </button>
        ))}
      </div>

      {view === "agents" ? (
        <AgentsView theme={theme} agents={agents} canEdit={canEdit} onChanged={load} />
      ) : (
        <>
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
            searchValue={(s) => `${s.name} ${s.ipAddress ?? ""} ${s.pollTarget ?? ""} ${s.zone?.name ?? ""}`}
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
                  {collectionMode(s) === "NONE" ? t("cyber.sensorSetup.provision") : t("cyber.sensorSetup.manage")}
                </button>
              ) : null
            }
          />
        </>
      )}

      {provisioning && (
        <ProvisioningModal theme={theme} sensor={provisioning} agents={agents} onClose={() => setProvisioning(null)} onChanged={load} />
      )}
    </div>
  );
}
