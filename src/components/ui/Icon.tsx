type IconName = string;

export function Icon({
  name,
  filled = false,
  className = "",
  size = 20,
}: {
  name: IconName;
  filled?: boolean;
  className?: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${filled ? 600 : 400}, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}
