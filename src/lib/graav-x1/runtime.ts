import "server-only";
import { assembleX1 } from "./assemble";
import { getConsolePorts } from "./ports";
let runtime: ReturnType<typeof assembleX1> | undefined;
let initializing: Promise<ReturnType<typeof assembleX1>> | undefined;
export function getX1Handler() {
  return async (request: Request) => {
    if (!runtime) {
      try {
        initializing ??= getConsolePorts().then((ports) => assembleX1(ports));
        runtime = await initializing;
      } catch {
        return Response.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
    }
    return runtime.handler(request);
  };
}
