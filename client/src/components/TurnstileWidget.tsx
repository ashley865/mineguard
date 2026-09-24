import { useEffect, useId, useRef } from "react";

// Renders nothing at all when VITE_TURNSTILE_SITE_KEY isn't set — the same "dormant until
// configured" convention as every other optional integration in this app, so registration
// and bid forms work exactly as they did before for anyone who hasn't set up Cloudflare
// Turnstile. No npm dependency: Cloudflare's own script is loaded once and told to render
// into this div via its data-* attributes, which is all its public API actually needs.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerId = `turnstile-${useId().replace(/:/g, "")}`;
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled) return;
      const turnstile = (window as any).turnstile;
      if (!turnstile) return;
      widgetId.current = turnstile.render(`#${containerId}`, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
      });
    });
    return () => {
      cancelled = true;
      const turnstile = (window as any).turnstile;
      if (turnstile && widgetId.current) turnstile.remove(widgetId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div id={containerId} />;
}
