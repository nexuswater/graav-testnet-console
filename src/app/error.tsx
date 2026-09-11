"use client";

import Link from "next/link";
import { AppChrome } from "@/components/AppChrome";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppChrome>
      <main className="g-main" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <section className="g-sheet" aria-labelledby="error-title" role="alert">
          <div className="g-status">Something went wrong</div>
          <h1 id="error-title" className="g-title">This page hit an error</h1>
          <p className="g-sub" style={{ marginTop: 8, lineHeight: 1.5 }}>
            Nothing was sent or signed. Try again, or head back to Markets.
          </p>
          {error.digest && (
            <p className="g-micro" style={{ marginTop: 8 }}>
              Reference <span className="g-mono">{error.digest}</span>
            </p>
          )}
          <button type="button" className="g-cta" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="g-cta ghost" style={{ textDecoration: "none" }}>
            Back to Markets
          </Link>
        </section>
      </main>
    </AppChrome>
  );
}
