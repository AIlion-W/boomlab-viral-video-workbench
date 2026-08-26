import { getOpenLuxPublicConfig } from "../../../_lib/viral-agent";

export async function GET() {
  return Response.json(getOpenLuxPublicConfig(), {
    headers: { "Cache-Control": "no-store" },
  });
}
