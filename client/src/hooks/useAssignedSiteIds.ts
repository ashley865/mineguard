import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

/**
 * For EXECUTIVE users, resolves which sites they're assigned to (governs access to
 * Visitor Management, Permit to Work, and escalated Risk Register views). `null` means
 * "unrestricted" (non-executive roles, e.g. Admin).
 */
export function useAssignedSiteIds() {
  const { user } = useAuth();
  const [siteIds, setSiteIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(user?.role === "EXECUTIVE");

  useEffect(() => {
    if (user?.role !== "EXECUTIVE") {
      setSiteIds(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.get<{ siteIds: string[] }>("/executive-sites/mine").then((res) => {
      if (!cancelled) {
        setSiteIds(res.data.siteIds);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  return { siteIds, loading };
}
