import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { IndustryNewsItem, IndustryNewsResponse } from "../api/types";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function NewsCard({ item }: { item: IndustryNewsItem }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] overflow-hidden">
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/90 leading-snug">{item.title}</p>
          <div className="text-[10px] text-white/40 mt-1">
            {item.source ?? t("liveData.unknownSource")}
            {item.publishedAt ? ` · ${timeAgo(item.publishedAt)}` : ""}
          </div>
        </div>
        <span className={`shrink-0 text-white/40 text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/10 pt-2">
          {item.summary ? (
            <div className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-hazard-500 text-white text-[9px] font-extrabold shrink-0 mt-0.5">
                AI
              </span>
              <p className="text-[11px] text-white/85 leading-relaxed italic">{item.summary}</p>
            </div>
          ) : item.snippet ? (
            <p className="text-[11px] text-white/70 leading-relaxed">{item.snippet}</p>
          ) : (
            <p className="text-[11px] text-white/40 italic">{t("liveData.noSummary")}</p>
          )}
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-[11px] font-semibold text-hazard-400 hover:text-hazard-300"
          >
            {t("liveData.readFullArticle")} →
          </a>
        </div>
      )}
    </div>
  );
}

// Its own standalone dark panel (same "live terminal" visual language as LiveDataWidget,
// but a separate section) rather than nested inside it — capped at 3 headlines server-side.
export default function IndustryNewsWidget() {
  const { t } = useTranslation();
  const [news, setNews] = useState<IndustryNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<IndustryNewsResponse>("/live-data/industry-news")
      .then((res) => {
        if (!cancelled) setNews(res.data);
      })
      .catch(() => {
        if (!cancelled) setNews(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  if (!news || news.items.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a1628] via-[#0f2140] to-[#0a1628] shadow-xl shadow-black/30">
      <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-hazard-500/10 blur-3xl" />
      <div className="relative p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
          </span>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-white">{t("liveData.industryNews")}</h2>
        </div>
        <div className="space-y-1.5">
          {news.items.map((item) => (
            <NewsCard key={item.link} item={item} />
          ))}
        </div>
        {news.disclaimer && <p className="text-[10px] text-white/35 leading-relaxed mt-1">{news.disclaimer}</p>}
      </div>
    </div>
  );
}
