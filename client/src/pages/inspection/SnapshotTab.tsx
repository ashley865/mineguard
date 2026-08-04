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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.documentsTotal")}</div>
              <div className="text-2xl font-bold mt-1">{snapshot.documents.total}</div>
            </div>
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.buyersTotal")}</div>
              <div className="text-2xl font-bold mt-1">{snapshot.buyers.total}</div>
            </div>
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.contractsAwarded")}</div>
              <div className="text-2xl font-bold mt-1">
                {snapshot.contracts.awarded} / {snapshot.contracts.total}
              </div>
            </div>
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.safetyObservationsOpen")}</div>
              <div className="text-2xl font-bold mt-1">
                {snapshot.safetyObservations.open} / {snapshot.safetyObservations.total}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.explosivesExpiring")}</div>
              <div className="text-2xl font-bold mt-1">
                {snapshot.explosives.expiringSoon} / {snapshot.explosives.total}
              </div>
            </div>
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.environmentalOutOfLimits")}</div>
              <div className="text-2xl font-bold mt-1">
                {snapshot.environmental.outOfLimits} / {snapshot.environmental.readingsCount}
              </div>
            </div>
            <div className={`${cardClass} px-4 py-3`}>
              <div className="text-xs text-mine-300 uppercase">{t("inspection.snapshot.productionTonnes30d")}</div>
              <div className="text-2xl font-bold mt-1">{snapshot.production.tonnesLast30Days.toLocaleString()}</div>
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

          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold mb-3">{t("inspection.snapshot.documentsSection")}</h3>
            <table className="w-full text-sm">
              <thead className="text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">{t("documents.colTitle")}</th>
                  <th className="text-left py-1">{t("documents.colType")}</th>
                  <th className="text-left py-1">{t("documents.reviewDate")}</th>
                  <th className="text-left py-1">{t("documents.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.documents.items.map((d) => (
                  <tr key={d.id} className="border-t border-mine-800">
                    <td className="py-1">{d.title}</td>
                    <td className="py-1 text-mine-300">{t(`documents.types.${d.type}`)}</td>
                    <td className="py-1 text-mine-300">{d.reviewDate ? new Date(d.reviewDate).toLocaleDateString() : "—"}</td>
                    <td className="py-1"><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
                {snapshot.documents.items.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-mine-400">{t("inspection.snapshot.noDocuments")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold mb-1">{t("inspection.snapshot.buyersSection")}</h3>
            <p className="text-xs text-mine-400 mb-3">{t("inspection.snapshot.buyersHint")}</p>
            <table className="w-full text-sm">
              <thead className="text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">{t("buyerRegister.legalName")}</th>
                  <th className="text-left py-1">{t("buyerRegister.buyerType")}</th>
                  <th className="text-left py-1">{t("buyerRegister.contactEmail")}</th>
                  <th className="text-left py-1">{t("buyerRegister.contactPhone")}</th>
                  <th className="text-left py-1">{t("buyerRegister.taxNumber")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.buyers.items.map((b) => (
                  <tr key={b.id} className="border-t border-mine-800">
                    <td className="py-1">{b.legalName}</td>
                    <td className="py-1 text-mine-300">{t(`buyerRegister.types.${b.buyerType}`)}</td>
                    <td className="py-1 text-mine-300">{b.contactEmail}</td>
                    <td className="py-1 text-mine-300">{b.contactPhone}</td>
                    <td className="py-1 text-mine-300">{b.taxNumber}</td>
                  </tr>
                ))}
                {snapshot.buyers.items.length === 0 && (
                  <tr><td colSpan={5} className="py-3 text-center text-mine-400">{t("inspection.snapshot.noBuyers")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold mb-3">{t("inspection.snapshot.contractsSection")}</h3>
            <table className="w-full text-sm">
              <thead className="text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">{t("marketplace.contractTitle")}</th>
                  <th className="text-left py-1">{t("tenders.category")}</th>
                  <th className="text-left py-1">{t("marketplace.deadline")}</th>
                  <th className="text-left py-1">{t("documents.colStatus")}</th>
                  <th className="text-left py-1">{t("inspection.snapshot.colAwardedTo")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.contracts.items.map((c) => (
                  <tr key={c.id} className="border-t border-mine-800">
                    <td className="py-1">{c.title}</td>
                    <td className="py-1 text-mine-300">{t(`tenders.categories.${c.category}`)}</td>
                    <td className="py-1 text-mine-300">{new Date(c.submissionDeadline).toLocaleDateString()}</td>
                    <td className="py-1"><StatusBadge status={c.status} /></td>
                    <td className="py-1 text-mine-300">{c.bids[0]?.companyName ?? t("inspection.snapshot.notAwarded")}</td>
                  </tr>
                ))}
                {snapshot.contracts.items.length === 0 && (
                  <tr><td colSpan={5} className="py-3 text-center text-mine-400">{t("inspection.snapshot.noContracts")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold mb-3">{t("inspection.snapshot.explosivesSection")}</h3>
            <table className="w-full text-sm">
              <thead className="text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">{t("explosives.magazineNumber")}</th>
                  <th className="text-left py-1">{t("explosives.licenseNumber")}</th>
                  <th className="text-left py-1">{t("explosives.licenseExpiry")}</th>
                  <th className="text-left py-1">{t("explosives.currentStock")}</th>
                  <th className="text-left py-1">{t("documents.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.explosives.items.map((m) => (
                  <tr key={m.id} className="border-t border-mine-800">
                    <td className="py-1">{m.magazineNumber}</td>
                    <td className="py-1 text-mine-300">{m.licenseNumber}</td>
                    <td className="py-1 text-mine-300">{new Date(m.licenseExpiry).toLocaleDateString()}</td>
                    <td className="py-1 text-mine-300">{m.currentStock} {m.unit}</td>
                    <td className="py-1"><StatusBadge status={m.status} /></td>
                  </tr>
                ))}
                {snapshot.explosives.items.length === 0 && (
                  <tr><td colSpan={5} className="py-3 text-center text-mine-400">{t("inspection.snapshot.noExplosives")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-sm font-semibold mb-3">{t("inspection.snapshot.environmentalSection")}</h3>
            <table className="w-full text-sm">
              <thead className="text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">{t("environmental.monitoringPoint")}</th>
                  <th className="text-left py-1">{t("environmental.parameterType")}</th>
                  <th className="text-left py-1">{t("environmental.value")}</th>
                  <th className="text-left py-1">{t("environmental.withinLimits")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.environmental.items.map((r) => (
                  <tr key={r.id} className="border-t border-mine-800">
                    <td className="py-1">{r.monitoringPoint}</td>
                    <td className="py-1 text-mine-300">{t(`environmental.parameterTypes.${r.parameterType}`)}</td>
                    <td className="py-1 text-mine-300">{r.value} {r.unit}</td>
                    <td className="py-1">
                      <span className={r.withinLimits ? "text-success-500" : "text-danger-400 font-semibold"}>
                        {r.withinLimits ? t("environmental.withinLimits") : t("environmental.outOfLimits")}
                      </span>
                    </td>
                  </tr>
                ))}
                {snapshot.environmental.items.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-mine-400">{t("inspection.snapshot.noEnvironmental")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
