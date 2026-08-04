import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";
import { useSocket } from "./SocketContext";
import { EmergencyEvacuation } from "../api/types";

interface EvacuationContextValue {
  active: EmergencyEvacuation[];
  trigger: (data: { siteId: string; assemblyPoint: string; message?: string }) => Promise<void>;
  cancel: (id: string) => Promise<void>;
}

const EvacuationContext = createContext<EvacuationContextValue>({
  active: [],
  trigger: async () => {},
  cancel: async () => {},
});

export function EvacuationProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const [active, setActive] = useState<EmergencyEvacuation[]>([]);

  async function loadActive() {
    try {
      const res = await api.get<EmergencyEvacuation[]>("/emergency/evacuations/active");
      setActive(res.data);
    } catch {
      // Not a member of a mine yet, or not authenticated — nothing to show.
    }
  }

  useEffect(() => {
    loadActive();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onNew = (evacuation: EmergencyEvacuation) => setActive((prev) => [evacuation, ...prev]);
    const onCancelled = ({ id }: { id: string }) => setActive((prev) => prev.filter((e) => e.id !== id));
    socket.on("emergency:evacuation", onNew);
    socket.on("emergency:evacuation-cancelled", onCancelled);
    return () => {
      socket.off("emergency:evacuation", onNew);
      socket.off("emergency:evacuation-cancelled", onCancelled);
    };
  }, [socket]);

  async function trigger(data: { siteId: string; assemblyPoint: string; message?: string }) {
    await api.post("/emergency/evacuations", data);
  }

  async function cancel(id: string) {
    await api.post(`/emergency/evacuations/${id}/cancel`);
  }

  return <EvacuationContext.Provider value={{ active, trigger, cancel }}>{children}</EvacuationContext.Provider>;
}

export function useEvacuation() {
  return useContext(EvacuationContext);
}
