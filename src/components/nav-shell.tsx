"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const NAV = [
  { href: "/", label: "Hub", icon: HomeIcon },
  { href: "/tasks", label: "Tasks", icon: CheckIcon },
  { href: "/scheduler", label: "Scheduler", icon: CalendarIcon },
  { href: "/stats", label: "Stats", icon: ChartIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
] as const;

export function NavShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden md:flex md:flex-col md:w-56 border-r border-border p-6 shrink-0">
        <p className="font-display text-xl mb-8">Aero Hub</p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-surface-2 text-text" : "text-text-muted hover:text-text",
                )}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto text-xs text-text-muted truncate">{email}</p>
      </aside>

      <div className="flex-1 min-w-0">
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-10 md:px-8">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-bg/95 backdrop-blur px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-1 py-2.5 px-3 text-[11px] transition-colors",
                  active ? "text-accent" : "text-text-muted",
                )}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.5 12.5 2.5 2.5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" strokeLinecap="round" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 20V10M12 20V4M19 20v-7" strokeLinecap="round" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4M17.8 17.8l-1.4-1.4M7.6 7.6 6.2 6.2" strokeLinecap="round" />
    </svg>
  );
}
