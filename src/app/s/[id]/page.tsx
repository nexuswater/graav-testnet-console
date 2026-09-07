import { getPublicSession } from "@/lib/signingSessionServer";
import { isPlaceholderOrBogusSessionId } from "@/lib/signingSession";
import { SigningSessionClient } from "@/components/session/SigningSessionClient";
import { InvalidSessionHelp } from "@/components/session/InvalidSessionHelp";
import { ConsoleBuy } from "@/components/graav-x1/ConsoleBuy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ via?: string | string[] }> };
export default async function SigningSessionPage({ params, searchParams }: Props) {
  const { id: raw } = await params; const { via } = await searchParams; let id = raw;
  try { id = decodeURIComponent(raw); } catch { id = raw; }
  if (/^[A-Za-z0-9_-]{32}$/.test(id)) return <ConsoleBuy sessionId={id} via={Array.isArray(via) ? "INVALID_DUPLICATE_VIA" : via} />;
  if (id.startsWith("rlusd_")) return <InvalidSessionHelp sessionId={id} />;
  if (isPlaceholderOrBogusSessionId(raw) || isPlaceholderOrBogusSessionId(id)) return <InvalidSessionHelp sessionId={id || raw} />;
  return <SigningSessionClient initial={getPublicSession(id)} />;
}
