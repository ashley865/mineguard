import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCall } from "../context/CallContext";
import { buttonDanger, buttonPrimary } from "./ui";

function useStreamRef(stream: MediaStream | null) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return ref;
}

function IncomingCallModal() {
  const { t } = useTranslation();
  const { incomingCall, acceptCall, declineCall } = useCall();
  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-mine-900 border border-mine-800 rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-hazard-500/20 text-hazard-400 flex items-center justify-center text-2xl mx-auto animate-pulse">
          📞
        </div>
        <div>
          <div className="text-lg font-bold">{incomingCall.fromUserName}</div>
          <div className="text-xs text-mine-400 mt-1">
            {incomingCall.video ? t("calling.incomingVideoCall") : t("calling.incomingVoiceCall")}
          </div>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button className={`${buttonDanger} px-5 py-2`} onClick={declineCall}>{t("calling.decline")}</button>
          <button className={`${buttonPrimary} px-5 py-2`} onClick={acceptCall}>{t("calling.accept")}</button>
        </div>
      </div>
    </div>
  );
}

function ActiveCallBar() {
  const { t } = useTranslation();
  const { callState, peerName, hasVideo, muted, videoOff, localStream, remoteStream, endCall, toggleMute, toggleVideo } = useCall();
  const localRef = useStreamRef(localStream);
  const remoteRef = useStreamRef(remoteStream);

  if (callState !== "calling" && callState !== "active") return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-mine-900 border border-mine-800 rounded-2xl shadow-lg shadow-black/30 w-72 overflow-hidden">
      <div className={`relative bg-black ${hasVideo ? "h-40" : "h-0"}`}>
        <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" />
        {hasVideo && (
          <video ref={localRef} autoPlay playsInline muted className="absolute bottom-2 right-2 w-16 h-12 rounded object-cover border border-mine-700" />
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="text-sm font-semibold truncate">{peerName}</div>
        <div className="text-xs text-mine-400">
          {callState === "calling" ? t("calling.callingStatus") : t("calling.connectedStatus")}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            className={`flex-1 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors ${muted ? "bg-hazard-500/20 text-hazard-400" : "bg-mine-800 text-mine-200 hover:bg-mine-700"}`}
            onClick={toggleMute}
          >
            {muted ? t("calling.unmute") : t("calling.mute")}
          </button>
          {hasVideo && (
            <button
              className={`flex-1 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors ${videoOff ? "bg-hazard-500/20 text-hazard-400" : "bg-mine-800 text-mine-200 hover:bg-mine-700"}`}
              onClick={toggleVideo}
            >
              {videoOff ? t("calling.videoOn") : t("calling.videoOff")}
            </button>
          )}
          <button className={`${buttonDanger} text-xs px-3 py-1.5`} onClick={endCall}>{t("calling.hangUp")}</button>
        </div>
      </div>
    </div>
  );
}

export default function CallUI() {
  return (
    <>
      <IncomingCallModal />
      <ActiveCallBar />
    </>
  );
}
