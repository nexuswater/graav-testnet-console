import Link from "next/link";
import { AppChrome } from "@/components/AppChrome";

export default function NotFound() {
  return (
    <AppChrome>
      <main className="g-main" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <section className="g-sheet" aria-labelledby="not-found-title">
          <div className="g-status">404</div>
          <h1 id="not-found-title" className="g-title">This page doesn&apos;t exist</h1>
          <p className="g-sub" style={{ marginTop: 8, lineHeight: 1.5 }}>
            The link may be old or mistyped. Coins live under Markets; launches start on X.
          </p>
          <Link href="/" className="g-cta" style={{ textDecoration: "none" }}>
            Back to Markets
          </Link>
          <Link href="/launch" className="g-cta ghost" style={{ textDecoration: "none" }}>
            Launch on X
          </Link>
        </section>
      </main>
    </AppChrome>
  );
}
