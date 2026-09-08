"use client";

import Link from "next/link";

export function MockSigningSession({ id }: { id: string }) {
  return (
    <div className="g-app">
      <main className="g-main" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <h1 className="g-display">Session unavailable</h1>
        <p className="g-sub" style={{ marginTop: 10 }}>
          Mock financial-success sessions are closed. Id {id} is not a live receipt.
        </p>
        <Link href="/" className="g-cta" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          Back to markets
        </Link>
      </main>
    </div>
  );
}
