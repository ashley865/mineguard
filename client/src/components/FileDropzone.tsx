import { useRef, useState } from "react";

export default function FileDropzone({
  onFiles,
  multiple,
  accept,
  hint,
}: {
  onFiles: (files: FileList) => void;
  multiple?: boolean;
  accept?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setFileNames(Array.from(files).map((f) => f.name));
    onFiles(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
        dragOver ? "border-hazard-500 bg-hazard-500/5" : "border-mine-700 hover:border-mine-600 bg-mine-800/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-mine-400 mb-1.5">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="text-xs text-mine-300">
        {fileNames.length > 0 ? fileNames.join(", ") : hint ?? "Click or drag files to upload"}
      </div>
    </div>
  );
}
