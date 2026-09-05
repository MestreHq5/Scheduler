"use client";

import { useRef, useState, useTransition } from "react";
import type { IcsFeed, IcsSource } from "@/lib/database.types";
import { saveIcsFeedLabel, saveIcsFeedUrl, syncIcsFeed, uploadIcsFile } from "@/lib/actions/ics";

export function IcsFeedSettings({
  source,
  feed,
  defaultLabel,
}: {
  source: IcsSource;
  feed: IcsFeed | null;
  defaultLabel: string;
}) {
  const [mode, setMode] = useState<"url" | "file">(feed?.kind ?? "url");
  const [url, setUrl] = useState(feed?.url ?? "");
  const [label, setLabel] = useState(feed?.label ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label !== (feed?.label ?? "")) startTransition(() => saveIcsFeedLabel(source, label));
          }}
          placeholder={defaultLabel}
          aria-label="Import name"
          className="font-medium text-sm bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none min-w-0 flex-1"
        />
        {feed?.last_synced_at && (
          <p className="text-xs text-text-muted shrink-0">
            last synced {new Date(feed.last_synced_at).toLocaleString()}
          </p>
        )}
      </div>
      <p className="text-xs text-text-muted mb-3 -mt-1">
        Name this import however you like — it&apos;s just a label, any kind of
        recurring event feed works here.
      </p>

      <div className="flex gap-4 text-xs mb-3">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "url"} onChange={() => setMode("url")} />
          Live URL
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "file"} onChange={() => setMode("file")} />
          Upload .ics file
        </label>
      </div>

      {mode === "url" ? (
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/calendar.ics"
            className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            disabled={pending || !url.trim()}
            onClick={() => startTransition(() => saveIcsFeedUrl(source, url.trim()))}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex gap-2 items-center">
          <input ref={fileRef} type="file" accept=".ics,text/calendar" className="text-xs flex-1" />
          <button
            disabled={pending}
            onClick={() => {
              const file = fileRef.current?.files?.[0];
              if (!file) return;
              startTransition(() => uploadIcsFile(source, file));
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            Upload
          </button>
        </div>
      )}

      {feed && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => syncIcsFeed(source))}
          className="mt-3 text-xs text-accent hover:opacity-80 disabled:opacity-50"
        >
          Sync now
        </button>
      )}
      {feed?.last_sync_status === "error" && (
        <p className="text-xs text-danger mt-1">{feed.last_sync_error}</p>
      )}
    </div>
  );
}
