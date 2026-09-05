"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useTransition } from "react";
import { signOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/", label: "Hub", icon: HomeIcon },
  { href: "/tasks", label: "Tasks", icon: CheckIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/stats", label: "Stats", icon: ChartIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
] as const;

export function NavShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className="min-h-dvh md:flex md:mx-auto md:max-w-[1440px]">
      <aside className="hidden md:flex md:flex-col md:w-56 md:sticky md:top-0 md:h-dvh border-r border-border p-6 shrink-0">
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex flex-col items-center text-center mb-8">
            <Logo className="w-9 h-9 mb-2" />
            <p className="font-display text-xl">Scheduler</p>
          </div>
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
        </div>
        <div className="mt-auto pt-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
            <span className="w-1.5 h-1.5 rounded-full bg-border" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
          </div>
          <p className="text-xs text-text-muted truncate mb-3">{email}</p>
          <ThemeToggle />
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => signOut())}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm w-full text-text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
          >
            <LogoutIcon />
            {pending ? "Logging out…" : "Log out"}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <main
          className={clsx(
            "mx-auto pt-10 pb-24 md:pb-10 md:pt-14",
            pathname.startsWith("/calendar") || pathname.startsWith("/tasks")
              ? "max-w-full px-3 md:px-6"
              : "max-w-3xl px-4 md:px-8",
          )}
        >
          {children}
        </main>
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

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 16l4-4-4-4M20 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
