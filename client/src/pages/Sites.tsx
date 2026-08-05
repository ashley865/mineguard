import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Site, SiteStatus, Zone } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";

function SiteForm({ initial, onSubmit, onCancel }: {
  initial?: Partial<Site>;
  onSubmit: (data: { name: string; location: string; description?: string; status: SiteStatus }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<SiteStatus>(initial?.status ?? "OPERATIONAL");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ name, location, description, status });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("sites.siteName")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.location")}</label>
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as SiteStatus)}>
          <option value="OPERATIONAL">{t("sites.operational")}</option>
          <option value="RESTRICTED">{t("sites.restricted")}</option>
          <option value="SHUT_DOWN">{t("sites.shutDown")}</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ZoneForm({ siteId, initial, onSubmit, onCancel }: {
  siteId: string;
  initial?: Partial<Zone>;
  onSubmit: (data: { name: string; description?: string; siteId: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ name, description, siteId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("sites.zoneName")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function Sites() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteModal, setSiteModal] = useState<null | "create" | Site>(null);
  const [zoneModal, setZoneModal] = useState<null | { siteId: string; zone?: Zone }>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<Site[]>("/sites");
    setSites(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createSite(data: any) {
    await api.post("/sites", data);
    setSiteModal(null);
    await load();
  }

  async function updateSite(id: string, data: any) {
    await api.put(`/sites/${id}`, data);
    setSiteModal(null);
    await load();
  }

  async function deleteSite(id: string) {
    if (!confirm(t("sites.confirmDeleteSite"))) return;
    await api.delete(`/sites/${id}`);
    await load();
  }

  async function createZone(data: any) {
    await api.post("/zones", data);
    setZoneModal(null);
    await load();
  }

  async function updateZone(id: string, data: any) {
    await api.put(`/zones/${id}`, data);
    setZoneModal(null);
    await load();
  }

  async function deleteZone(id: string) {
    if (!confirm(t("sites.confirmDeleteZone"))) return;
    await api.delete(`/zones/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("sites.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t("sites.title")}</h1>
          <p className="text-mine-300 text-sm">{t("sites.subtitle")}</p>
        </div>
        {canEdit && (
          <button className={buttonPrimary} onClick={() => setSiteModal("create")}>
            {t("sites.newSite")}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {sites.map((site) => (
          <div key={site.id} className={`${cardClass} p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-lg">{site.name}</h2>
                  <StatusBadge status={site.status} />
                  {site.workforcePresence && (
                    <span className="text-xs text-mine-300">
                      <span className="text-success-500 font-semibold">{site.workforcePresence.present} {t("sites.present")}</span>
                      {" · "}
                      <span className="text-mine-400">{site.workforcePresence.total - site.workforcePresence.present} {t("sites.notPresent")}</span>
                    </span>
                  )}
                </div>
                <div className="text-sm text-mine-300">{site.location}</div>
                {site.description && <div className="text-sm text-mine-400 mt-1">{site.description}</div>}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button className={buttonSecondary} onClick={() => setSiteModal(site)}>{t("common.edit")}</button>
                  {(user?.role === "ADMIN" || user?.role === "EXECUTIVE") && (
                    <button className={buttonDanger} onClick={() => deleteSite(site.id)}>{t("common.delete")}</button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-mine-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-mine-200">{t("sites.zones")}</h3>
                {canEdit && (
                  <button
                    className="text-xs text-mine-300 hover:text-mine-50 underline"
                    onClick={() => setZoneModal({ siteId: site.id })}
                  >
                    {t("sites.addZone")}
                  </button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(site.zones ?? []).map((zone) => (
                  <div key={zone.id} className="border border-mine-800 rounded-md p-3 flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium">{zone.name}</div>
                      {zone.description && <div className="text-xs text-mine-400">{zone.description}</div>}
                      {zone.workforcePresence && (
                        <div className="text-[11px] mt-0.5">
                          <span className="text-success-500 font-semibold">{zone.workforcePresence.present} {t("sites.present")}</span>
                          {" · "}
                          <span className="text-mine-400">{zone.workforcePresence.total - zone.workforcePresence.present} {t("sites.notPresent")}</span>
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          className="text-xs text-mine-300 hover:text-mine-50"
                          onClick={() => setZoneModal({ siteId: site.id, zone })}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          className="text-xs text-danger-400 hover:text-danger-300"
                          onClick={() => deleteZone(zone.id)}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {(site.zones ?? []).length === 0 && (
                  <div className="text-xs text-mine-400">{t("sites.noZonesYet")}</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {sites.length === 0 && <div className="text-mine-400">{t("sites.noSitesYet")}</div>}
      </div>

      {siteModal && (
        <Modal title={siteModal === "create" ? t("sites.newSiteTitle") : t("sites.editSiteTitle")} onClose={() => setSiteModal(null)}>
          <SiteForm
            initial={siteModal === "create" ? undefined : siteModal}
            onSubmit={(data) => (siteModal === "create" ? createSite(data) : updateSite(siteModal.id, data))}
            onCancel={() => setSiteModal(null)}
          />
        </Modal>
      )}

      {zoneModal && (
        <Modal title={zoneModal.zone ? t("sites.editZoneTitle") : t("sites.newZoneTitle")} onClose={() => setZoneModal(null)}>
          <ZoneForm
            siteId={zoneModal.siteId}
            initial={zoneModal.zone}
            onSubmit={(data) =>
              zoneModal.zone ? updateZone(zoneModal.zone.id, data) : createZone(data)
            }
            onCancel={() => setZoneModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
