function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Avatar({
  src,
  name,
  size = 36,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-full overflow-hidden bg-mine-800 border border-mine-700 flex items-center justify-center text-mine-300 font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initials(name) || "?"}</span>
      )}
    </div>
  );
}
