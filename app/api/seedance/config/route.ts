import { isArkConfigured } from "../../../_lib/ark-video";

export async function GET() {
  return Response.json(
    { configured: isArkConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
