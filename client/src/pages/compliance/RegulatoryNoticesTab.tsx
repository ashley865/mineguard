import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { NoticeSection, NoticeStatus, RegulatoryNotice, Site, Zone } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../../components/ui";

const sections: NoticeSection[] = ["SECTION_54", "SECTION_55", "SECTION_53", "OTHER"];
const statuses: NoticeStatus[] = ["OPEN", "COMPLIED", "WITHDRAWN", "APPEALED"];

function NoticeForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<RegulatoryNotice>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [noticeNumber, setNoticeNumber] = useState(initial?.noticeNumber ?? "");
  const [section, setSection] = useState<NoticeSection>(initial?.section ?? "SECTION_54");
  const [issuedBy, setIssuedBy] = useState(initial?.issuedBy ?? "");
  const [issuedDate, setIssuedDate] = useState(initial?.issuedDate?.slice(0, 10) ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [complianceDeadline, setComplianceDeadline] = useState(initial?.complianceDeadline?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<NoticeStatus>(initial?.status ?? "OPEN");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        noticeNumber,
        section,
        issuedBy,
        issuedDate,
        description,
        complianceDeadline: complianceDeadline || null,
        status,
        siteId,
        zoneId: zoneId || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.notice.noticeNumber")}</label>
          <input className={inputClass} value={noticeNumber} onChange={(e) => setNoticeNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("compliance.notice.section")}</label>
          <select className={inputClass} value={section} onChange={(e) => setSection(e.target.value as NoticeSection)}>
            {sections.map((s) => <option key={s} value={s}>{t(`compliance.notice.sections.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.notice.issuedBy")}</label>
          <input className={inputClass} value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("compliance.notice.issuedDate")}</label>
          <input className={inputClass} type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.notice.descriptionField")}</label>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.notice.complianceDeadline")}</label>
          <input className={inputClass} type="date" value={complianceDeadline} onChange={(e) => setComplianceDeadline(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as NoticeStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={inputClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
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

export default function RegulatoryNoticesTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<RegulatoryNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | RegulatoryNotice>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<RegulatoryNotice[]>("/regulatory-notices");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/regulatory-notices", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/regulatory-notices/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("compliance.notice.confirmDelete"))) return;
    await api.delete(`/regulatory-notices/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("compliance.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("compliance.notice.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("compliance.notice.colNumber")}</th>
              <th className="text-left px-4 py-2">{t("compliance.notice.colSection")}</th>
              <th className="text-left px-4 py-2">{t("compliance.notice.colIssuedBy")}</th>
              <th className="text-left px-4 py-2">{t("compliance.notice.colDeadline")}</th>
              <th className="text-left px-4 py-2">{t("compliance.notice.colStatus")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.noticeNumber}</td>
                <td className="px-4 py-2 text-mine-300">{t(`compliance.notice.sections.${item.section}`)}</td>
                <td className="px-4 py-2 text-mine-300">{item.issuedBy}</td>
                <td className="px-4 py-2 text-mine-300">
                  {item.complianceDeadline ? new Date(item.complianceDeadline).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("compliance.notice.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("compliance.notice.newTitle") : t("compliance.notice.editTitle")} onClose={() => setModal(null)}>
          <NoticeForm
            sites={sites}
            zones={zones}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
