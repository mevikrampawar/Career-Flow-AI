import { Icon } from "./ui/Icon";

export function MatchScore({
  score,
  size = "md",
}: {
  score?: number;
  size?: "sm" | "md";
}) {
  if (score === undefined) return null;
  const pill = size === "md" ? "px-2.5 py-1 text-label-sm" : "px-2 py-0.5 text-label-sm";

  if (score >= 90) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-accent-lime/20 text-on-surface ${pill}`}
        title={`AI match: ${score}%`}
      >
        <Icon name="auto_awesome" size={14} />
        {score}% Match
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-surface-container-high text-on-surface-variant ${pill}`}
      title={`AI match: ${score}%`}
    >
      {score}% Match
    </span>
  );
}

export function ScoreLabel({ score }: { score: number }) {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Moderate match";
  return "Weak match";
}
