import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../api/client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const s = io(API_URL, { transports: ["websocket"], auth: { token } });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

/**
 * Tracks whether the shared socket is actually connected right now, for anything showing a
 * "live" indicator — `useSocket()` alone only tells you an instance exists, not whether it's
 * currently reachable (it can be mid-reconnect after a dropped wifi/VPN link).
 */
export function useSocketConnected(): boolean {
  const socket = useSocket();
  const [connected, setConnected] = useState(!!socket?.connected);

  useEffect(() => {
    if (!socket) {
      setConnected(false);
      return;
    }
    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  return connected;
}
