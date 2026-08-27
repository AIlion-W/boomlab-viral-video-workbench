import { ARK_MODEL_ID, isArkConfigured } from "../../../_lib/ark-video";

export async function GET() {
  const arkConfigured = isArkConfigured();
  return Response.json(
    {
      configured: arkConfigured,
      arkConfigured,
      provider: "volcengine",
      model: ARK_MODEL_ID,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
