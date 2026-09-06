import { Suspense } from "react";
import { Console } from "@/components/Console";

export default function Home() {
  return (
    <Suspense fallback={<div className="g-app" style={{ padding: 24 }}>Loading…</div>}>
      <Console />
    </Suspense>
  );
}
