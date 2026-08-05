import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Site, Visitor } from "../api/types";
import { useAssignedSiteIds } from "../hooks/useAssignedSiteIds";
import { StatusBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";

function QrPanel({ site }: { site: Site }) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const checkinUrl = `${window.location.origin}/visit/${site.id}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(checkinUrl, { width: 220, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [checkinUrl]);

  return (
    <div className={`${cardClass} p-5 flex flex-col items-center text-center gap-3`}>
      <h2 className="text-sm font-semibold">{t("visitors.qrTitle", { site: site.name })}</h2>
      {dataUrl && <img src={dataUrl} alt="Visitor check-in QR code" className="rounded-md border border-mine-800" />}
      <p className="text-xs text-mine-400 max-w-xs">{t("visitors.qrHint")}</p>
      <div className="flex items-center gap-2 w-full">
        <input className={`${inputClass} text-xs`} readOnly value={checkinUrl} onClick={(e) => e.currentTarget.select()} />
        <button
          className={`${buttonSecondary} text-xs px-3 py-2 whitespace-nowrap`}
          onClick={() => navigator.clipboard.writeText(checkinUrl)}
        >
          {t("common.copy")}
        </button>
      </div>
    </div>
  );
}

function RequestLinkAccessCard() {
  const { t } = useTranslation();
  return (
    <div className={`${cardClass} p-5 space-y-2 text-center`}>
      <h2 className="text-sm font-semibold">{t("visitors.linkRestrictedTitle")}</h2>
      <p className="text-xs text-mine-400">{t("visitors.linkRestrictedBody")}</p>
      <Link to="/executive-requests" className={`${buttonSecondary} inline-block text-xs px-3 py-1.5 mt-1`}>
        {t("visitors.requestLinkAccess")}
      </Link>
    </div>
  );
}

export default function VisitorManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canShareLink = user?.role === "ADMIN" || user?.title === "SECURITY_MANAGER";
  const { siteIds: assignedSiteIds, loading: loadingAssignment } = useAssignedSiteIds();
  const [sites, setSites] = useState<Site[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [siteId, setSiteId] = useState("");
  const [loading, setLoading] = useState(true);

  const availableSites = assignedSiteIds === null ? sites : sites.filter((s) => assignedSiteIds.includes(s.id));

  async function loadSites() {
    const res = await api.get<Site[]>("/sites");
    setSites(res.data);
  }

  async function loadVisitors(forSiteId: string) {
    setLoading(true);
    const res = await api.get<Visitor[]>("/visitors", { params: forSiteId ? { siteId: forSiteId } : undefined });
    setVisitors(res.data);
    setLoading(false);
  }

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (loadingAssignment) return;
    if (!siteId && availableSites.length > 0) {
      setSiteId(availableSites[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAssignment, availableSites.length]);

  useEffect(() => {
    if (siteId) loadVisitors(siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function checkout(id: string) {
    await api.post(`/visitors/${id}/checkout`);
    await loadVisitors(siteId);
  }

  async function approve(id: string) {
    await api.post(`/visitors/${id}/approve`);
    await loadVisitors(siteId);
  }

  async function deny(id: string) {
    await api.post(`/visitors/${id}/deny`);
    await loadVisitors(siteId);
  }

  async function arrive(id: string) {
    await api.post(`/visitors/${id}/arrive`);
    await loadVisitors(siteId);
  }

  if (loadingAssignment) return <div className="text-mine-300">{t("visitors.loading")}</div>;

  if (availableSites.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">{t("visitors.title")}</h1>
        <div className={`${cardClass} p-6 text-center text-mine-300`}>{t("visitors.noSiteAccess")}</div>
      </div>
    );
  }

  const selectedSite = availableSites.find((s) => s.id === siteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("visitors.title")}</h1>
          <p className="text-mine-300 text-sm">{t("visitors.subtitle")}</p>
        </div>
        <div className="w-56">
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {availableSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {selectedSite && (canShareLink ? <QrPanel site={selectedSite} /> : <RequestLinkAccessCard />)}
        </div>

        <div className="lg:col-span-2">
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("visitors.colName")}</th>
                  <th className="text-left px-4 py-2">{t("visitors.colHost")}</th>
                  <th className="text-left px-4 py-2">{t("visitors.colScheduled")}</th>
                  <th className="text-left px-4 py-2">{t("visitors.colCheckIn")}</th>
                  <th className="text-left px-4 py-2">{t("visitors.colCheckOut")}</th>
                  <th className="text-left px-4 py-2">{t("common.status")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  visitors.map((v) => (
                    <tr key={v.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                      <td className="px-4 py-2 font-medium">
                        {v.fullName}
                        {v.company && <div className="text-xs text-mine-400">{v.company}</div>}
                      </td>
                      <td className="px-4 py-2 text-mine-300">{v.hostName}</td>
                      <td className="px-4 py-2 text-mine-300">
                        {new Date(v.scheduledFor).toLocaleString()}
                        {v.isEmergency && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-danger-500 text-white">
                            {t("visitors.emergency")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-mine-300">
                        {v.checkInAt ? new Date(v.checkInAt).toLocaleString() : t("visitors.notArrived")}
                      </td>
                      <td className="px-4 py-2 text-mine-300">
                        {v.checkOutAt ? new Date(v.checkOutAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                        {v.status === "PENDING_APPROVAL" && (
                          <>
                            <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => approve(v.id)}>
                              {t("visitors.approve")}
                            </button>
                            <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => deny(v.id)}>
                              {t("visitors.deny")}
                            </button>
                          </>
                        )}
                        {v.status === "APPROVED" && (
                          <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => arrive(v.id)}>
                            {t("visitors.arrive")}
                          </button>
                        )}
                        {v.status === "CHECKED_IN" && (
                          <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => checkout(v.id)}>
                            {t("visitors.checkOut")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {!loading && visitors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-mine-400">
                      {t("visitors.noneYet")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
