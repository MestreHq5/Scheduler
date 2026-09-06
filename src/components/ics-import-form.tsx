"use client";

import { useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { importIcsAsTag } from "@/lib/actions/ics";
import { IcsHelpModal } from "@/components/ics-help-modal";

export function IcsImportForm() {
  const [tagLabel, setTagLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  function handleImport() {
    const file = fileRef.current?.files?.[0];
    const label = tagLabel.trim();
    if (!label || !file) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const result = await importIcsAsTag(label, file);
        setMessage({
          error: false,
          text: `Imported ${result.count} event${result.count === 1 ? "" : "s"} as "${result.label}".`,
        });
        setTagLabel("");
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
        Upload a .ics file and name a tag — every event in it becomes a block under that tag, all one color. Import
        again with a different name any time you need to add another calendar.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={tagLabel}
          onChange={(e) => setTagLabel(e.target.value)}
          placeholder="Tag name, e.g. Classes"
          className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input ref={fileRef} type="file" accept=".ics,text/calendar" className="text-xs sm:flex-1" />
      </div>

      <button
        type="button"
        disabled={pending || !tagLabel.trim()}
        onClick={handleImport}
        className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import"}
      </button>

      {message && <p className={clsx("text-xs", message.error ? "text-danger" : "text-accent")}>{message.text}</p>}
    </div>
  );
}
