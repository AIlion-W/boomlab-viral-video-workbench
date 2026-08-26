import {
  parseRewriteRequest,
  rewriteVideo,
  viralAgentErrorResponse,
} from "../../../_lib/viral-agent";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const input = parseRewriteRequest(payload);
    const result = await rewriteVideo(input);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return viralAgentErrorResponse(error);
  }
}
