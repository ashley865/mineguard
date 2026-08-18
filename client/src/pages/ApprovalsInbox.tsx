import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ApprovalInboxItem, ApprovalsInboxResponse } from "../api/types";
import { cardClass, buttonPrimary, buttonDanger } from "../components/ui";
import LoadError from "../components/LoadError";
import DataTable, { DataTableColumn } from "../components/DataTable";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <div className="text-xs text-mine-300 uppercase">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function ApprovalsInbox() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canView = user?.role === "ADMIN" || ["CFO", "GENERAL_MANAGER", "COO"].includes(user?.title ?? "");
  const [data, setData] = useState<ApprovalsInboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ApprovalsInboxResponse>("/approvals-inbox");
      setData(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approveExpense(id: string) {
    setBusyId(id);
    try {
      await api.post(`/expenses/${id}/review`, { decision: "PAID" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function rejectExpense(id: string) {
    if (!confirm(t("approvalsInbox.confirmReject"))) return;
    setBusyId(id);
    try {
      await api.post(`/expenses/${id}/review`, { decision: "CANCELLED" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function approveOrder(id: string) {
    setBusyId(id);
    try {
      await api.post(`/procurement/orders/${id}/approve`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!canView) return <Navigate to="/" replace />;
  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;
  if (!data) return null;

  const money = (n: number, currency = "ZAR") => `${currency} ${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("approvalsInbox.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("approvalsInbox.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("approvalsInbox.pendingExpenses")} value={String(data.totals.expenseCount)} />
        <StatCard label={t("approvalsInbox.pendingExpenseTotal")} value={money(data.totals.expenseTotal)} />
        <StatCard label={t("approvalsInbox.submittedOrders")} value={String(data.totals.purchaseOrderCount)} />
        <StatCard label={t("approvalsInbox.submittedOrderTotal")} value={money(data.totals.purchaseOrderTotal)} />
      </div>

      <DataTable
        columns={
          [
            {
              key: "type",
              header: t("approvalsInbox.type"),
              render: (i) => (
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${i.type === "EXPENSE" ? "bg-hazard-500 text-white" : "bg-mine-700 text-white"}`}>
                  {t(`approvalsInbox.types.${i.type}`)}
                </span>
              ),
              sortValue: (i) => i.type,
            },
            { key: "reference", header: t("approvalsInbox.reference"), render: (i) => i.reference, sortValue: (i) => i.reference },
            { key: "description", header: t("approvalsInbox.description"), render: (i) => i.description },
            { key: "site", header: t("common.site"), render: (i) => i.site?.name ?? "—", sortValue: (i) => i.site?.name ?? "" },
            { key: "requestedBy", header: t("approvalsInbox.requestedBy"), render: (i) => i.requestedBy?.name ?? "—" },
            { key: "amount", header: t("approvalsInbox.amount"), render: (i) => money(i.amount, i.currency), sortValue: (i) => i.amount },
            { key: "createdAt", header: t("approvalsInbox.submitted"), render: (i) => new Date(i.createdAt).toLocaleDateString(), sortValue: (i) => i.createdAt },
          ] as DataTableColumn<ApprovalInboxItem>[]
        }
        rows={data.items}
        rowKey={(i) => `${i.type}-${i.id}`}
        emptyMessage={t("approvalsInbox.noneYet")}
        searchValue={(i) => `${i.reference} ${i.description} ${i.requestedBy?.name ?? ""}`}
        exportFilename="approvals-inbox"
        exportColumns={[
          { header: t("approvalsInbox.type"), value: (i) => i.type },
          { header: t("approvalsInbox.reference"), value: (i) => i.reference },
          { header: t("approvalsInbox.description"), value: (i) => i.description },
          { header: t("common.site"), value: (i) => i.site?.name ?? "" },
          { header: t("approvalsInbox.requestedBy"), value: (i) => i.requestedBy?.name ?? "" },
          { header: t("approvalsInbox.amount"), value: (i) => i.amount },
        ]}
        actions={(i) => (
          <div className="flex justify-end gap-2">
            {i.type === "EXPENSE" ? (
              <>
                <Link to="/expenses" className="text-xs text-mine-300 hover:text-mine-50">{t("common.view")}</Link>
                <button className={`${buttonPrimary} text-xs px-3 py-1`} disabled={busyId === i.id} onClick={() => approveExpense(i.id)}>
                  {t("common.approve")}
                </button>
                <button className={buttonDanger} disabled={busyId === i.id} onClick={() => rejectExpense(i.id)}>
                  {t("common.reject")}
                </button>
              </>
            ) : (
              <>
                <Link to="/procurement" className="text-xs text-mine-300 hover:text-mine-50">{t("common.view")}</Link>
                <button className={`${buttonPrimary} text-xs px-3 py-1`} disabled={busyId === i.id} onClick={() => approveOrder(i.id)}>
                  {t("common.approve")}
                </button>
              </>
            )}
          </div>
        )}
      />
    </div>
  );
}
