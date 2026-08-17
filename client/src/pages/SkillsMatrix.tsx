import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Skill, SkillProficiency, Worker, WorkerSkillRating } from "../api/types";
import Modal from "../components/Modal";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import LoadError from "../components/LoadError";

const levels: SkillProficiency[] = ["NOVICE", "COMPETENT", "PROFICIENT", "EXPERT"];
const LEVEL_ORDER: Record<SkillProficiency, number> = { NOVICE: 0, COMPETENT: 1, PROFICIENT: 2, EXPERT: 3 };

const LEVEL_COLORS: Record<SkillProficiency, string> = {
  NOVICE: "bg-mine-600 text-mine-100",
  COMPETENT: "bg-hazard-500/70 text-white",
  PROFICIENT: "bg-hazard-500 text-white",
  EXPERT: "bg-success-600 text-white",
};

function SkillForm({ initial, onSubmit, onCancel }: {
  initial?: Skill;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [targetLevel, setTargetLevel] = useState<SkillProficiency | "">(initial?.targetLevel ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ name, category: category || undefined, targetLevel: targetLevel || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("skillsMatrix.skillName")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("skillsMatrix.category")}</label>
        <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("skillsMatrix.targetLevel")}</label>
        <select className={selectClass} value={targetLevel} onChange={(e) => setTargetLevel(e.target.value as SkillProficiency | "")}>
          <option value="">{t("skillsMatrix.noTarget")}</option>
          {levels.map((l) => <option key={l} value={l}>{t(`skillsMatrix.levels.${l}`)}</option>)}
        </select>
        <p className="text-xs text-mine-400 mt-1">{t("skillsMatrix.targetLevelHint")}</p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function SkillsMatrix() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [ratings, setRatings] = useState<WorkerSkillRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | Skill>(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [w, s, r] = await Promise.all([
        api.get<Worker[]>("/workers"),
        api.get<Skill[]>("/skills-matrix/skills"),
        api.get<WorkerSkillRating[]>("/skills-matrix/ratings"),
      ]);
      setWorkers(w.data);
      setSkills(s.data);
      setRatings(r.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createSkill(data: any) {
    await api.post("/skills-matrix/skills", data);
    setModal(null);
    await load();
  }

  async function updateSkill(id: string, data: any) {
    await api.put(`/skills-matrix/skills/${id}`, data);
    setModal(null);
    await load();
  }

  async function removeSkill(id: string) {
    if (!confirm(t("skillsMatrix.confirmDeleteSkill"))) return;
    await api.delete(`/skills-matrix/skills/${id}`);
    await load();
  }

  async function setRating(workerId: string, skillId: string, level: string) {
    if (!level) return;
    await api.put("/skills-matrix/ratings", { workerId, skillId, level });
    await load();
  }

  const ratingFor = (workerId: string, skillId: string) => ratings.find((r) => r.workerId === workerId && r.skillId === skillId);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) if (s.category) set.add(s.category);
    return Array.from(set).sort();
  }, [skills]);

  const visibleSkills = categoryFilter ? skills.filter((s) => s.category === categoryFilter) : skills;

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("skillsMatrix.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("skillsMatrix.subtitle")}</p>
        </div>
        {canEdit && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("skillsMatrix.newSkill")}</button>
        )}
      </div>

      {skills.length === 0 && (
        <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("skillsMatrix.noSkillsYet")}</div>
      )}

      {skills.length > 0 && categories.length > 0 && (
        <div className="flex items-center gap-2">
          <label className={labelClass}>{t("skillsMatrix.filterByCategory")}</label>
          <select className={`${selectClass} w-auto`} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">{t("skillsMatrix.allCategories")}</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {visibleSkills.length > 0 && workers.length > 0 && (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 sticky left-0 bg-mine-800/50">{t("workers.title")}</th>
                {visibleSkills.map((s) => (
                  <th key={s.id} className="text-left px-4 py-2 whitespace-nowrap">
                    <button type="button" className="hover:text-mine-50" onClick={() => canEdit && setModal(s)} disabled={!canEdit}>
                      {s.name}
                    </button>
                    {s.category && <div className="text-[9px] normal-case text-mine-500">{s.category}</div>}
                    {s.targetLevel && (
                      <div className="text-[9px] normal-case text-hazard-500">{t("skillsMatrix.target")}: {t(`skillsMatrix.levels.${s.targetLevel}`)}</div>
                    )}
                    {canDelete && (
                      <button className="ml-1.5 text-mine-500 hover:text-danger-500" onClick={() => removeSkill(s.id)}>×</button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium sticky left-0 bg-mine-900">{w.name}</td>
                  {visibleSkills.map((s) => {
                    const rating = ratingFor(w.id, s.id);
                    const belowTarget = !!s.targetLevel && (!rating || LEVEL_ORDER[rating.level] < LEVEL_ORDER[s.targetLevel]);
                    return (
                      <td key={s.id} className={`px-4 py-2 ${belowTarget ? "ring-1 ring-inset ring-danger-500/60" : ""}`}>
                        {canEdit ? (
                          <select
                            className={`text-xs font-semibold rounded px-2 py-1 border-0 ${rating ? LEVEL_COLORS[rating.level] : "bg-mine-800 text-mine-400"}`}
                            value={rating?.level ?? ""}
                            onChange={(e) => setRating(w.id, s.id, e.target.value)}
                          >
                            <option value="">{t("skillsMatrix.notRated")}</option>
                            {levels.map((l) => <option key={l} value={l}>{t(`skillsMatrix.levels.${l}`)}</option>)}
                          </select>
                        ) : rating ? (
                          <span className={`text-xs font-semibold rounded px-2 py-1 ${LEVEL_COLORS[rating.level]}`}>
                            {t(`skillsMatrix.levels.${rating.level}`)}
                          </span>
                        ) : (
                          <span className="text-xs text-mine-500">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === "create" ? t("skillsMatrix.newSkillTitle") : t("skillsMatrix.editSkillTitle")} onClose={() => setModal(null)}>
          <SkillForm
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? createSkill(data) : updateSkill(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
