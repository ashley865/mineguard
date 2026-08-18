import { ReactNode } from "react";
import { CyberTheme } from "./cyberTheme";

// Local themed counterpart to the shared Modal component, for the same reason as
// CyberTable — the shared Modal is hard-wired to the app's light "mine-*" palette.
export default function CyberModal({ theme, title, onClose, children, size = "md" }: { theme: CyberTheme; title: string; onClose: () => void; children: ReactNode; size?: "md" | "lg" }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`${theme.panel} w-full ${size === "lg" ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`}>
        <div className={`flex items-center justify-between px-5 py-4 ${theme.panelHeader}`}>
          <h2 className={`text-base font-semibold ${theme.text}`}>{title}</h2>
          <button onClick={onClose} className={`${theme.subtext} hover:opacity-80 text-xl leading-none`}>
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
