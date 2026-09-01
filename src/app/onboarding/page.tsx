"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  async function confirm() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ timezone, onboarded: true })
      .eq("id", user.id);

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl mb-2">Welcome.</h1>
        <p className="text-text-muted mb-8">
          One thing first: confirm your timezone. Everything — blocks, deadlines,
          imported events — is scheduled against it. Summer/winter time shifts
          automatically after this.
        </p>

        <label className="block text-sm text-text-muted mb-2">Timezone (IANA)</label>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-xl bg-surface border border-border py-3 px-4 outline-none focus:border-accent transition-colors mb-6"
        />

        <button
          onClick={confirm}
          disabled={saving || !timezone}
          className="w-full rounded-xl bg-accent text-bg font-semibold py-3 px-4 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving…" : "Confirm and continue"}
        </button>
      </div>
    </main>
  );
}
