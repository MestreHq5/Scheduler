"use client";

import { useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { importIcsAsTags } from "@/lib/actions/ics";
import { IcsHelpModal } from "@/components/ics-help-modal";

export function IcsImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const result = await importIcsAsTags(file);
        setMessage({
          error: false,
          text: `Imported ${result.count} event${result.count === 1 ? "" : "s"} across ${result.tagLabels.length} tag${result.tagLabels.length === 1 ? "" : "s"}: ${result.tagLabels.join(", ")}.`,
        });
        setHasFile(false);
        if (fileRef.current) fileRef.current.value = "";
      } catch (err) {
        setMessage({ error: true, text: err instanceof Error ? err.message : "Import failed." });
      }
    });
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Import a calendar file</p>
        <IcsHelpModal />
      </div>
      <p className="text-xs text-text-muted -mt-2">
        Upload a .ics file — each event&apos;s CATEGORIES value becomes its own tag, created fresh with its own
        color, so one file can import several differently-tagged calendars at once. Import again any time you need
        to add more.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          onChange={(e) => setHasFile(!!e.target.files?.length)}
          className="text-xs flex-1"
        />
      </div>

      <button
        type="button"
        disabled={pending || !hasFile}
        onClick={handleImport}
        className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import"}
      </button>

      {message && <p className={clsx("text-xs", message.error ? "text-danger" : "text-accent")}>{message.text}</p>}
    </div>
  );
}
