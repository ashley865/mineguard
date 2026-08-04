import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { ExecutiveSiteAssignment, ExecutiveTitle, Site } from "../../api/types";
import { buttonDanger, buttonPrimary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";

interface ExecutiveOption {
  id: string;
  name: string;
  email: string;
  title?: ExecutiveTitle | null;
}

export default function ExecutiveAccessTab() {
  const { t } = useTranslation();
  const [executives, setExecutives] = useState<ExecutiveOption[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assignments, setAssignments] = useState<ExecutiveSiteAssignment[]>([]);
  const [userId, setUserId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [e, s, a] = await Promise.all([
      api.get<ExecutiveOption[]>("/executive-sites/executives"),
      api.get<Site[]>("/sites"),
      api.get<ExecutiveSiteAssignment[]>("/executive-sites"),
    ]);
    setExecutives(e.data);
    setSites(s.data);
    setAssignments(a.data);
    setUserId((prev) => prev || e.data[0]?.id || "");
    setSiteId((prev) => prev || s.data[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function assign(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/executive-sites", { userId, siteId });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || t("executiveAccess.assignError"));
    }
  }

  async function unassign(id: string) {
    await api.delete(`/executive-sites/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("executiveAccess.loading")}</div>;

  return (
    <div className="space-y-6">
      <p className="text-mine-300 text-sm">{t("executiveAccess.subtitle")}</p>

      {executives.length === 0 ? (
        <div className={`${cardClass} p-6 text-center text-mine-300`}>{t("executiveAccess.noExecutives")}</div>
      ) : (
        <div className={`${cardClass} p-5`}>
          <form onSubmit={assign} className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className={labelClass}>{t("executiveAccess.executive")}</label>
              <select className={selectClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
                {executives.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}{ex.title ? ` — ${t(`settings.invites.titles.${ex.title}`)}` : ""} ({ex.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-56">
              <label className={labelClass}>{t("common.site")}</label>
              <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button type="submit" className={buttonPrimary}>{t("executiveAccess.assign")}</button>
          </form>
          {error && <div className="text-danger-500 text-xs mt-2">{error}</div>}
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("executiveAccess.executive")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">
                  {a.user.name}
                  {a.user.title && <div className="text-xs text-mine-400">{t(`settings.invites.titles.${a.user.title}`)} · {a.user.email}</div>}
                  {!a.user.title && <div className="text-xs text-mine-400">{a.user.email}</div>}
                </td>
                <td className="px-4 py-2 text-mine-300">{a.site.name}</td>
                <td className="px-4 py-2 text-right">
                  <button className={buttonDanger} onClick={() => unassign(a.id)}>{t("common.delete")}</button>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-mine-400">{t("executiveAccess.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
