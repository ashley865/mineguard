import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { ComplianceSnapshot, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import { buttonSecondary, cardClass, inputClass } from "../../components/ui";

export default function SnapshotTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [snapshot, setSnapshot] = useState<ComplianceSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(id: string) {
    if (!id) return;
    setLoading(true);
    const res = await api.get<ComplianceSnapshot>(`/inspection-snapshot/${id}`);
    setSnapshot(res.data);
    setLoading(false);
  }

  useEffect(() => {
    if (siteId) load(siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  if (sites.length === 0) {
    return <div className="text-mine-400">{t("inspection.snapshot.noSites")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <select className={`${inputClass} max-w-xs`} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className={buttonSecondary} onClick={() => window.print()}>{t("inspection.snapshot.print")}</button>
      </div>

      {loading && <div className="text-mine-300">{t("inspection.loading")}</div>}

      {!loading && snapshot && (
        <div className="space-y-6">
          <div className={`${cardClass} p-5`}>
            <h2 className="text-lg font-bold">{snapshot.site.name}</h2>
            <div className="text-sm text-mine-300">{snapshot.site.location}</div>
            <div className="text-xs text-mine-400 mt-1">
              {t("inspection.snapshot.generatedAt", { date: new Date(snapshot.generatedAt).toLocaleString() })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.openNotices")}</div>
              <div className="text-2xl font-bold mt-1">{snapshot.openNotices.length}</div>
            </div>
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.activePermits")}</div>
              <div className="text-2xl font-bold mt-1">
                {snapshot.permits.filter((p) => p.status === "ACTIVE").length} / {snapshot.permits.length}
              </div>
            </div>
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.inspectionsCompleted")}</div>
              <div className="text-2xl font-bold mt-1">
                {snapshot.safetyInspections.completed} / {snapshot.safetyInspections.total}
              </div>
            </div>
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.certificatesActive")}</div>
              <div className="text-2xl font-bold mt-1">
                {snapshot.workforce.certificatesActive} / {snapshot.workforce.certificatesTotal}
              </div>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold mb-3">{t("inspection.snapshot.permits")}</h3>
            <table className="w-full text-sm">
              <thead className="text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">{t("permits.colNumber")}</th>
                  <th className="text-left py-1">{t("permits.colType")}</th>
                  <th className="text-left py-1">{t("permits.colExpiry")}</th>
                  <th className="text-left py-1">{t("permits.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.permits.map((p) => (
                  <tr key={p.id} className="border-t border-mine-800">
                    <td className="py-1">{p.permitNumber}</td>
                    <td className="py-1 text-mine-300">{t(`permits.types.${p.type}`)}</td>
                    <td className="py-1 text-mine-300">{new Date(p.expiryDate).toLocaleDateString()}</td>
                    <td className="py-1"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {snapshot.permits.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-mine-400">{t("permits.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold mb-3">{t("inspection.snapshot.codesOfPractice")}</h3>
            <table className="w-full text-sm">
              <thead className="text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">{t("compliance.cop.colTitle")}</th>
                  <th className="text-left py-1">{t("compliance.cop.colCategory")}</th>
                  <th className="text-left py-1">{t("compliance.cop.colReviewDate")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.codesOfPractice.map((c) => (
                  <tr key={c.id} className="border-t border-mine-800">
                    <td className="py-1">{c.title}</td>
                    <td className="py-1 text-mine-300">{t(`compliance.cop.categories.${c.category}`)}</td>
                    <td className="py-1 text-mine-300">{new Date(c.reviewDate).toLocaleDateString()}</td>
                  </tr>
                ))}
                {snapshot.codesOfPractice.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-center text-mine-400">{t("compliance.cop.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold mb-3">{t("inspection.snapshot.openNoticesList")}</h3>
            <table className="w-full text-sm">
              <thead className="text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">{t("compliance.notice.colNumber")}</th>
                  <th className="text-left py-1">{t("compliance.notice.colSection")}</th>
                  <th className="text-left py-1">{t("compliance.notice.colDeadline")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.openNotices.map((n) => (
                  <tr key={n.id} className="border-t border-mine-800">
                    <td className="py-1">{n.noticeNumber}</td>
                    <td className="py-1 text-mine-300">{t(`compliance.notice.sections.${n.section}`)}</td>
                    <td className="py-1 text-mine-300">
                      {n.complianceDeadline ? new Date(n.complianceDeadline).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {snapshot.openNotices.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-center text-mine-400">{t("inspection.snapshot.noOpenNotices")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold mb-3">{t("inspection.snapshot.recentVisits")}</h3>
            <table className="w-full text-sm">
              <thead className="text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">{t("inspection.visit.colDate")}</th>
                  <th className="text-left py-1">{t("inspection.visit.colInspector")}</th>
                  <th className="text-left py-1">{t("inspection.visit.colOutcome")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.recentVisits.map((v) => (
                  <tr key={v.id} className="border-t border-mine-800">
                    <td className="py-1">{new Date(v.visitDate).toLocaleDateString()}</td>
                    <td className="py-1 text-mine-300">{v.inspectorName}</td>
                    <td className="py-1 text-mine-300">{t(`inspection.visit.outcomes.${v.outcome}`)}</td>
                  </tr>
                ))}
                {snapshot.recentVisits.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-center text-mine-400">{t("inspection.visit.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
