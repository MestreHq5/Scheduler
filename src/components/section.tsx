import Link from "next/link";

export function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="font-display text-xl">{title}</h2>
        {href && (
          <Link href={href} className="text-sm text-text-muted hover:text-text">
            View all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
