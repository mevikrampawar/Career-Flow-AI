export function MatchScore({
  score,
  size = "md",
}: {
  score?: number;
  size?: "sm" | "md";
}) {
  if (score === undefined) return null;
  const tone =
    score >= 75
      ? "text-success"
      : score >= 50
        ? "text-warning"
        : "text-on-surface-variant";
  const ring = size === "md" ? "size-14 text-sm" : "size-10 text-xs";

  return (
    <div
      className={`relative grid ${ring} shrink-0 place-items-center rounded-full border-2 ${tone} ${
        score >= 75
          ? "border-success/40"
          : score >= 50
            ? "border-warning/40"
            : "border-outline-variant"
      }`}
      title={`AI match: ${score}%`}
    >
      <span className="font-semibold">{score}%</span>
    </div>
  );
}

export function ScoreLabel({ score }: { score: number }) {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Moderate match";
  return "Weak match";
}
