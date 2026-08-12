import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { DesignatedGroup, EmploymentEquityTarget, MiningCharterElement, OccupationalLevel, ProcurementSpendSummary } from "../../api/types";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";

const occupationalLevels: OccupationalLevel[] = [
  "TOP_MANAGEMENT",
  "SENIOR_MANAGEMENT",
  "PROFESSIONALLY_QUALIFIED",
  "SKILLED_TECHNICAL",
  "SEMI_SKILLED",
  "UNSKILLED",
];
const designatedGroups: DesignatedGroup[] = ["AFRICAN", "COLOURED", "INDIAN", "WHITE", "FOREIGN_NATIONAL"];

function TargetForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [reportingYear, setReportingYear] = useState(new Date().getFullYear().toString());
  const [occupationalLevel, setOccupationalLevel] = useState<OccupationalLevel>("SKILLED_TECHNICAL");
  const [designatedGroup, setDesignatedGroup] = useState<DesignatedGroup>("AFRICAN");
  const [gender, setGender] = useState("MALE");
  const [targetPercent, setTargetPercent] = useState("");
  const [actualHeadcount, setActualHeadcount] = useState("0");
  const [totalHeadcountAtLevel, setTotalHeadcountAtLevel] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        reportingYear: Number(reportingYear),
        occupationalLevel,
        designatedGroup,
        gender,
        targetPercent: Number(targetPercent),
        actualHeadcount: Number(actualHeadcount),
        totalHeadcountAtLevel: Number(totalHeadcountAtLevel),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("employmentEquity.reportingYear")}</label>
          <input className={inputClass} type="number" value={reportingYear} onChange={(e) => setReportingYear(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("employmentEquity.occupationalLevel")}</label>
          <select className={selectClass} value={occupationalLevel} onChange={(e) => setOccupationalLevel(e.target.value as OccupationalLevel)}>
            {occupationalLevels.map((l) => <option key={l} value={l}>{t(`employmentEquity.occupationalLevels.${l}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("employmentEquity.designatedGroup")}</label>
          <select className={selectClass} value={designatedGroup} onChange={(e) => setDesignatedGroup(e.target.value as DesignatedGroup)}>
            {designatedGroups.map((g) => <option key={g} value={g}>{t(`employmentEquity.designatedGroups.${g}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("employmentEquity.gender")}</label>
          <select className={selectClass} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="MALE">{t("employmentEquity.male")}</option>
            <option value="FEMALE">{t("employmentEquity.female")}</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("employmentEquity.targetPercent")}</label>
          <input className={inputClass} type="number" step="any" value={targetPercent} onChange={(e) => setTargetPercent(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("employmentEquity.actualHeadcount")}</label>
          <input className={inputClass} type="number" value={actualHeadcount} onChange={(e) => setActualHeadcount(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("employmentEquity.totalHeadcountAtLevel")}</label>
          <input className={inputClass} type="number" value={totalHeadcountAtLevel} onChange={(e) => setTotalHeadcountAtLevel(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function CharterElementForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [reportingYear, setReportingYear] = useState(new Date().getFullYear().toString());
  const [elementName, setElementName] = useState("");
  const [targetPercent, setTargetPercent] = useState("");
  const [actualPercent, setActualPercent] = useState("");
  const [status, setStatus] = useState("ON_TRACK");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        reportingYear: Number(reportingYear),
        elementName,
        targetPercent: targetPercent ? Number(targetPercent) : null,
        actualPercent: actualPercent ? Number(actualPercent) : null,
        status,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("employmentEquity.reportingYear")}</label>
          <input className={inputClass} type="number" value={reportingYear} onChange={(e) => setReportingYear(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("employmentEquity.elementName")}</label>
          <input className={inputClass} value={elementName} onChange={(e) => setElementName(e.target.value)} required placeholder={t("employmentEquity.elementNamePlaceholder") ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("employmentEquity.targetPercent")}</label>
          <input className={inputClass} type="number" step="any" value={targetPercent} onChange={(e) => setTargetPercent(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("employmentEquity.actualPercent")}</label>
          <input className={inputClass} type="number" step="any" value={actualPercent} onChange={(e) => setActualPercent(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ON_TRACK">{t("employmentEquity.charterStatuses.ON_TRACK")}</option>
            <option value="AT_RISK">{t("employmentEquity.charterStatuses.AT_RISK")}</option>
            <option value="NOT_MET">{t("employmentEquity.charterStatuses.NOT_MET")}</option>
            <option value="MET">{t("employmentEquity.charterStatuses.MET")}</option>
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

export default function EmploymentEquityTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [targets, setTargets] = useState<EmploymentEquityTarget[]>([]);
  const [elements, setElements] = useState<MiningCharterElement[]>([]);
  const [spend, setSpend] = useState<ProcurementSpendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetModal, setTargetModal] = useState(false);
  const [elementModal, setElementModal] = useState(false);

  async function load() {
    setLoading(true);
    const [t1, t2, t3] = await Promise.all([
      api.get<EmploymentEquityTarget[]>("/employment-equity/targets"),
      api.get<MiningCharterElement[]>("/employment-equity/charter-elements"),
      api.get<ProcurementSpendSummary>("/employment-equity/procurement-spend"),
    ]);
    setTargets(t1.data);
    setElements(t2.data);
    setSpend(t3.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createTarget(data: any) {
    await api.post("/employment-equity/targets", data);
    setTargetModal(false);
    await load();
  }

  async function removeTarget(id: string) {
    await api.delete(`/employment-equity/targets/${id}`);
    await load();
  }

  async function createElement(data: any) {
    await api.post("/employment-equity/charter-elements", data);
    setElementModal(false);
    await load();
  }

  async function removeElement(id: string) {
    await api.delete(`/employment-equity/charter-elements/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      {spend && (
        <div className={`${cardClass} p-4 flex flex-wrap gap-6`}>
          <div>
            <div className="text-xs text-mine-400 uppercase">{t("employmentEquity.totalProcurementSpend")}</div>
            <div className="text-lg font-semibold">{spend.totalSpend.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-mine-400 uppercase">{t("employmentEquity.bbbeeRatedSpend")}</div>
            <div className="text-lg font-semibold">{spend.bbbeeRatedSpend.toLocaleString()} ({spend.bbbeeRatedSpendPercent.toFixed(1)}%)</div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mine-200">{t("employmentEquity.targetsTitle")}</h2>
          {canEdit && <button className={buttonPrimary} onClick={() => setTargetModal(true)}>{t("employmentEquity.newTarget")}</button>}
        </div>
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("employmentEquity.reportingYear")}</th>
                <th className="text-left px-4 py-2">{t("employmentEquity.occupationalLevel")}</th>
                <th className="text-left px-4 py-2">{t("employmentEquity.designatedGroup")}</th>
                <th className="text-left px-4 py-2">{t("employmentEquity.targetVsActual")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {targets.map((tg) => (
                <tr key={tg.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{tg.reportingYear}</td>
                  <td className="px-4 py-2 text-mine-300">{t(`employmentEquity.occupationalLevels.${tg.occupationalLevel}`)}</td>
                  <td className="px-4 py-2 text-mine-300">{t(`employmentEquity.designatedGroups.${tg.designatedGroup}`)} / {t(`employmentEquity.${tg.gender === "MALE" ? "male" : "female"}`)}</td>
                  <td className="px-4 py-2 text-mine-300">
                    {tg.targetPercent}% ({tg.actualHeadcount}/{tg.totalHeadcountAtLevel}
                    {tg.totalHeadcountAtLevel > 0 ? ` = ${((tg.actualHeadcount / tg.totalHeadcountAtLevel) * 100).toFixed(1)}%` : ""})
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canDelete && <button className={buttonDanger} onClick={() => removeTarget(tg.id)}>{t("common.delete")}</button>}
                  </td>
                </tr>
              ))}
              {targets.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("employmentEquity.noTargets")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mine-200">{t("employmentEquity.charterTitle")}</h2>
          {canEdit && <button className={buttonPrimary} onClick={() => setElementModal(true)}>{t("employmentEquity.newElement")}</button>}
        </div>
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("employmentEquity.reportingYear")}</th>
                <th className="text-left px-4 py-2">{t("employmentEquity.elementName")}</th>
                <th className="text-left px-4 py-2">{t("employmentEquity.targetVsActual")}</th>
                <th className="text-left px-4 py-2">{t("common.status")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {elements.map((el) => (
                <tr key={el.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{el.reportingYear}</td>
                  <td className="px-4 py-2 text-mine-300">{el.elementName}</td>
                  <td className="px-4 py-2 text-mine-300">{el.targetPercent ?? "—"}% / {el.actualPercent ?? "—"}%</td>
                  <td className="px-4 py-2 text-mine-300">{t(`employmentEquity.charterStatuses.${el.status}`)}</td>
                  <td className="px-4 py-2 text-right">
                    {canDelete && <button className={buttonDanger} onClick={() => removeElement(el.id)}>{t("common.delete")}</button>}
                  </td>
                </tr>
              ))}
              {elements.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("employmentEquity.noElements")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {targetModal && (
        <Modal title={t("employmentEquity.newTargetTitle")} onClose={() => setTargetModal(false)}>
          <TargetForm onSubmit={createTarget} onCancel={() => setTargetModal(false)} />
        </Modal>
      )}
      {elementModal && (
        <Modal title={t("employmentEquity.newElementTitle")} onClose={() => setElementModal(false)}>
          <CharterElementForm onSubmit={createElement} onCancel={() => setElementModal(false)} />
        </Modal>
      )}
    </div>
  );
}
