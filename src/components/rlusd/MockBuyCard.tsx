"use client";

export function MockBuyCard({ xPostId }: { xPostId: string }) {
  return (
    <div className="g-card" style={{ marginTop: 20 }}>
      <h2 className="g-title">Mock buy closed</h2>
      <p className="g-sub" style={{ marginTop: 8 }}>
        Preview session {xPostId} cannot complete. Use wallet-signed Trade. Unknown values stay unknown.
      </p>
    </div>
  );
}
