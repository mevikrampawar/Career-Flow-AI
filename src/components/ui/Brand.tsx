export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}careerflow_ai_primary_wordmark.png`}
      alt="CareerFlow AI"
      className={className}
      draggable={false}
    />
  );
}
