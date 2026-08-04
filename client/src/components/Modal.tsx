import { ReactNode } from "react";

const sizeClass = {
  md: "max-w-lg",
  lg: "max-w-3xl",
};

export default function Modal({
  title,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`bg-mine-900 border border-mine-800 rounded-lg w-full ${sizeClass[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-mine-800">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-mine-300 hover:text-mine-50 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
