"use client";

import { useEffect, useState } from "react";

export function IcsHelpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-text-muted hover:text-text underline underline-offset-2 shrink-0"
      >
        Help
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-surface border border-border p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg">Building a calendar file that imports cleanly</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-text-muted hover:text-text"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 text-xs text-text-muted">
              <p>
                A <code>.ics</code> file is the standard calendar format almost anything can export — a school
                portal, Google/Outlook Calendar, or an AI you ask to write one for you. Here&apos;s what this app
                needs from it:
              </p>

              <div>
                <p className="font-medium text-text mb-1">List out every date — don&apos;t use a repeating rule</p>
                <p>
                  Calendar files can describe a class two ways: as one &quot;repeats every week&quot; rule, or as a
                  separate entry for every single date it happens. <strong>Always use the second kind.</strong> This
                  app only reads the first date of a repeating rule and silently ignores the rest, so a weekly class
                  written as a single rule will show up once instead of every week. If you&apos;re asking an AI to
                  generate the file, tell it explicitly: &quot;write one event per date, don&apos;t use a recurrence
                  rule (RRULE).&quot;
                </p>
              </div>

              <div>
                <p className="font-medium text-text mb-1">Each event needs</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>A unique ID (any distinct text works, e.g. one per date/class combo).</li>
                  <li>A start time and an end time, on the same calendar day (no overnight events).</li>
                  <li>
                    Times written in UTC, ending in &quot;Z&quot; (e.g. <code>20260115T090000Z</code> for 9am UTC) —
                    this avoids the file being read in the wrong timezone.
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-text mb-1">Naming</p>
                <p>
                  Keep each event&apos;s title short (around 30 characters) — it becomes a small label under the
                  tag you name during import. A location field is fine to include but won&apos;t be used.
                </p>
              </div>

              <div>
                <p className="font-medium text-text mb-1">How import uses it</p>
                <p>
                  Every event in the file becomes a block, all under the one tag name you type in the import form —
                  so they all share a color. You can recolor or retag individual blocks afterward from the calendar.
                  Importing again (same file or a different one) is always safe — it just adds more blocks under
                  whatever new tag name you give it.
                </p>
              </div>

              <div>
                <p className="font-medium text-text mb-1">Minimal example (one event)</p>
                <pre className="rounded-lg bg-surface-2 border border-border p-2 overflow-x-auto text-[11px] leading-relaxed">
{`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ae101-2026-01-15@example.com
DTSTART:20260115T090000Z
DTEND:20260115T103000Z
SUMMARY:AE101 Lecture
END:VEVENT
END:VCALENDAR`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
