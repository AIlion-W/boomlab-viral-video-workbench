import {
  arkErrorResponse,
  createArkTask,
  parseCreateArkTaskInput,
} from "../../../_lib/ark-video";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const input = parseCreateArkTaskInput(payload);
    const task = await createArkTask(input);
    return Response.json(
      { ...task, status: "queued" },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return arkErrorResponse(error);
  }
}
