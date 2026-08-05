import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Visitor } from "../api/types";
import { StatusBadge } from "./Badges";
import { cardClass } from "./ui";

export default function SecurityVisitorHistoryWidget() {
  const { t } = useTranslation();
  const [visitors, setVisitors] = useState<Visitor[] | null>(null);

  useEffect(() => {
    api.get<Visitor[]>("/visitors").then((res) => setVisitors(res.data.slice(0, 20)));
  }, []);

  if (!visitors) return null;

  return (
    <div className={`${cardClass} p-3`}>
      <h2 className="text-xs font-semibold mb-2">{t("executive.visitorHistoryTitle")}</h2>
      {visitors.length === 0 ? (
        <div className="text-mine-400 text-xs">{t("executive.noVisitorHistory")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-mine-400 uppercase">
              <tr>
                <th className="text-left pr-3 py-1.5">{t("visitors.colName")}</th>
                <th className="text-left pr-3 py-1.5">{t("visitors.colCompany")}</th>
                <th className="text-left pr-3 py-1.5">{t("visitors.colHost")}</th>
                <th className="text-left pr-3 py-1.5">{t("common.site")}</th>
                <th className="text-left pr-3 py-1.5">{t("visitors.colCheckIn")}</th>
                <th className="text-left pr-3 py-1.5">{t("visitors.colCheckOut")}</th>
                <th className="text-left py-1.5">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mine-800">
              {visitors.map((v) => (
                <tr key={v.id}>
                  <td className="pr-3 py-1.5 font-medium">{v.fullName}</td>
                  <td className="pr-3 py-1.5 text-mine-300">{v.company ?? "—"}</td>
                  <td className="pr-3 py-1.5 text-mine-300">{v.hostName}</td>
                  <td className="pr-3 py-1.5 text-mine-300">{v.site?.name ?? "—"}</td>
                  <td className="pr-3 py-1.5 text-mine-400">
                    {v.checkInAt ? new Date(v.checkInAt).toLocaleString() : new Date(v.scheduledFor).toLocaleString()}
                  </td>
                  <td className="pr-3 py-1.5 text-mine-400">{v.checkOutAt ? new Date(v.checkOutAt).toLocaleString() : "—"}</td>
                  <td className="py-1.5"><StatusBadge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
