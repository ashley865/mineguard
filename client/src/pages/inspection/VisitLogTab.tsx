import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { InspectionOutcome, InspectionVisit, RegulatoryNotice, Site } from "../../api/types";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../../components/ui";

const outcomes: InspectionOutcome[] = ["NO_ACTION", "VERBAL_WARNING", "NOTICE_ISSUED", "FOLLOW_UP_REQUIRED"];

function VisitForm({ sites, notices, initial, onSubmit, onCancel }: {
  sites: Site[];
  notices: RegulatoryNotice[];
  initial?: Partial<InspectionVisit>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [visitDate, setVisitDate] = useState(initial?.visitDate?.slice(0, 10) ?? "");
  const [inspectorName, setInspectorName] = useState(initial?.inspectorName ?? "");
  const [inspectorBadge, setInspectorBadge] = useState(initial?.inspectorBadge ?? "");
  const [authority, setAuthority] = useState(initial?.authority ?? "Department of Mineral Resources and Energy (DMRE)");
  const [areasInspected, setAreasInspected] = useState(initial?.areasInspected ?? "");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [findings, setFindings] = useState(initial?.findings ?? "");
  const [outcome, setOutcome] = useState<InspectionOutcome>(initial?.outcome ?? "NO_ACTION");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [relatedNoticeId, setRelatedNoticeId] = useState(initial?.relatedNoticeId ?? "");
  const [saving, setSaving] = useState(false);

  const noticesForSite = notices.filter((n) => n.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        visitDate,
        inspectorName,
        inspectorBadge: inspectorBadge || undefined,
        authority,
        areasInspected,
        purpose: purpose || undefined,
        findings: findings || undefined,
        outcome,
        siteId,
        relatedNoticeId: relatedNoticeId || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("inspection.visit.visitDate")}</label>
          <input className={inputClass} type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setRelatedNoticeId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("inspection.visit.inspectorName")}</label>
          <input className={inputClass} value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("inspection.visit.inspectorBadge")}</label>
          <input className={inputClass} value={inspectorBadge} onChange={(e) => setInspectorBadge(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("inspection.visit.authority")}</label>
        <input className={inputClass} value={authority} onChange={(e) => setAuthority(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("inspection.visit.areasInspected")}</label>
        <input className={inputClass} value={areasInspected} onChange={(e) => setAreasInspected(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("inspection.visit.purpose")}</label>
        <input className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("inspection.visit.findings")}</label>
        <textarea className={inputClass} value={findings} onChange={(e) => setFindings(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("inspection.visit.outcome")}</label>
          <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value as InspectionOutcome)}>
            {outcomes.map((o) => <option key={o} value={o}>{t(`inspection.visit.outcomes.${o}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("inspection.visit.relatedNotice")}</label>
          <select className={inputClass} value={relatedNoticeId} onChange={(e) => setRelatedNoticeId(e.target.value)}>
            <option value="">{t("inspection.visit.noNotice")}</option>
            {noticesForSite.map((n) => <option key={n.id} value={n.id}>{n.noticeNumber}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function VisitLogTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<InspectionVisit[]>([]);
  const [notices, setNotices] = useState<RegulatoryNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | InspectionVisit>(null);

  async function load() {
    setLoading(true);
    const [v, n] = await Promise.all([
      api.get<InspectionVisit[]>("/inspection-visits"),
      api.get<RegulatoryNotice[]>("/regulatory-notices"),
    ]);
    setItems(v.data);
    setNotices(n.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/inspection-visits", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/inspection-visits/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("inspection.visit.confirmDelete"))) return;
    await api.delete(`/inspection-visits/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("inspection.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("inspection.visit.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("inspection.visit.colDate")}</th>
              <th className="text-left px-4 py-2">{t("inspection.visit.colSite")}</th>
              <th className="text-left px-4 py-2">{t("inspection.visit.colInspector")}</th>
              <th className="text-left px-4 py-2">{t("inspection.visit.colAreas")}</th>
              <th className="text-left px-4 py-2">{t("inspection.visit.colOutcome")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(v.visitDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{v.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">
                  {v.inspectorName}{v.inspectorBadge ? ` (${v.inspectorBadge})` : ""}
                </td>
                <td className="px-4 py-2 text-mine-300">{v.areasInspected}</td>
                <td className="px-4 py-2 text-mine-300">{t(`inspection.visit.outcomes.${v.outcome}`)}</td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(v)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(v.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("inspection.visit.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("inspection.visit.newTitle") : t("inspection.visit.editTitle")} onClose={() => setModal(null)}>
          <VisitForm
            sites={sites}
            notices={notices}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
