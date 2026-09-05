import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <Logo className="w-10 h-10 mx-auto mb-6" />
        <p className="font-display italic text-xl text-accent mb-2 tracking-wide">Off course,</p>
        <h1 className="font-display text-5xl mb-4">404</h1>
        <p className="text-text-muted mb-8">
          This page drifted out of orbit — it doesn&apos;t exist, or it moved.
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-accent text-bg font-semibold py-3 px-6 hover:opacity-90 transition-opacity"
        >
          Back to Hub
        </Link>
      </div>
    </main>
  );
}
