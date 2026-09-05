export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="5.5" fill="var(--color-accent)" />
      <path
        d="M28 16a12 12 0 0 1-9 11.6"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M4 16A12 12 0 0 1 16 4"
        stroke="var(--color-text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="26.2" cy="21.6" r="1.6" fill="var(--color-accent)" />
    </svg>
  );
}
