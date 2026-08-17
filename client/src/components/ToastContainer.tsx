import { useToast } from "../context/ToastContext";
import { cardClass } from "./ui";

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[110] space-y-2 w-80 max-w-[90vw]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${cardClass} p-3 shadow-lg cursor-pointer ${
            toast.variant === "emergency"
              ? "border-2 border-danger-500 shadow-danger-500/30 animate-pulse"
              : "border-hazard-500/40 shadow-black/30"
          }`}
          onClick={() => {
            toast.onClick?.();
            dismissToast(toast.id);
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className={`text-sm font-semibold truncate ${toast.variant === "emergency" ? "text-danger-500" : ""}`}>
                {toast.variant === "emergency" ? "🚨 " : ""}
                {toast.title}
              </div>
              {toast.body && <div className="text-xs text-mine-300 mt-0.5 line-clamp-2">{toast.body}</div>}
            </div>
            <button
              className="text-mine-400 hover:text-mine-50 text-lg leading-none shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(toast.id);
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
