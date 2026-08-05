import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export type CallState = "idle" | "calling" | "ringing" | "active";

interface IncomingCall {
  fromUserId: string;
  fromUserName: string;
  offer: RTCSessionDescriptionInit;
  video: boolean;
}

interface CallContextValue {
  callState: CallState;
  peerName: string | null;
  hasVideo: boolean;
  muted: boolean;
  videoOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  incomingCall: IncomingCall | null;
  startCall: (toUserId: string, toUserName: string, video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>("idle");
  const [peerName, setPeerName] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    peerIdRef.current = null;
    pendingCandidatesRef.current = [];
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setPeerName(null);
    setHasVideo(false);
    setMuted(false);
    setVideoOff(false);
    setIncomingCall(null);
    setCallState("idle");
  }, []);

  function createPeerConnection(toUserId: string) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit("call:ice-candidate", { toUserId, candidate: e.candidate.toJSON() });
      }
    };
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0] ?? null);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        if (peerIdRef.current) endCall();
      }
    };
    pcRef.current = pc;
    return pc;
  }

  const startCall = useCallback(
    async (toUserId: string, toUserName: string, video: boolean) => {
      if (!socket || callState !== "idle") return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setHasVideo(video);
      peerIdRef.current = toUserId;
      setPeerName(toUserName);

      const pc = createPeerConnection(toUserId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call:invite", { toUserId, offer, video, fromUserName: user?.name ?? "Someone" });
      setCallState("calling");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socket, callState, user?.name]
  );

  const acceptCall = useCallback(async () => {
    if (!socket || !incomingCall) return;
    const { fromUserId, fromUserName, offer, video } = incomingCall;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setHasVideo(video);
    peerIdRef.current = fromUserId;
    setPeerName(fromUserName);

    const pc = createPeerConnection(fromUserId);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    for (const candidate of pendingCandidatesRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
    pendingCandidatesRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("call:accept", { toUserId: fromUserId, answer });
    setIncomingCall(null);
    setCallState("active");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, incomingCall]);

  const declineCall = useCallback(() => {
    if (socket && incomingCall) socket.emit("call:reject", { toUserId: incomingCall.fromUserId });
    setIncomingCall(null);
    setCallState("idle");
  }, [socket, incomingCall]);

  const endCall = useCallback(() => {
    if (socket && peerIdRef.current) socket.emit("call:end", { toUserId: peerIdRef.current });
    cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream || !hasVideo) return;
    const next = !videoOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !next));
    setVideoOff(next);
  }, [hasVideo, videoOff]);

  useEffect(() => {
    if (!socket) return;

    function onInvite(payload: { fromUserId: string; fromUserName: string; offer: RTCSessionDescriptionInit; video: boolean }) {
      setCallState((current) => {
        if (current !== "idle") {
          socket!.emit("call:reject", { toUserId: payload.fromUserId });
          return current;
        }
        setIncomingCall({ fromUserId: payload.fromUserId, fromUserName: payload.fromUserName, offer: payload.offer, video: payload.video });
        return "ringing";
      });
    }

    async function onAccept(payload: { fromUserId: string; answer: RTCSessionDescriptionInit }) {
      const pc = pcRef.current;
      if (!pc || peerIdRef.current !== payload.fromUserId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
      pendingCandidatesRef.current = [];
      setCallState("active");
    }

    function onReject(payload: { fromUserId: string }) {
      if (peerIdRef.current !== payload.fromUserId) return;
      cleanup();
    }

    async function onIceCandidate(payload: { fromUserId: string; candidate: RTCIceCandidateInit }) {
      if (peerIdRef.current && peerIdRef.current !== payload.fromUserId) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(payload.candidate);
      }
    }

    function onEnd(payload: { fromUserId: string }) {
      if (peerIdRef.current !== payload.fromUserId && incomingCall?.fromUserId !== payload.fromUserId) return;
      cleanup();
    }

    socket.on("call:invite", onInvite);
    socket.on("call:accept", onAccept);
    socket.on("call:reject", onReject);
    socket.on("call:ice-candidate", onIceCandidate);
    socket.on("call:end", onEnd);
    return () => {
      socket.off("call:invite", onInvite);
      socket.off("call:accept", onAccept);
      socket.off("call:reject", onReject);
      socket.off("call:ice-candidate", onIceCandidate);
      socket.off("call:end", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, cleanup]);

  return (
    <CallContext.Provider
      value={{
        callState,
        peerName,
        hasVideo,
        muted,
        videoOff,
        localStream,
        remoteStream,
        incomingCall,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
