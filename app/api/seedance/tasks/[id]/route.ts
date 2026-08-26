import {
  arkErrorResponse,
  getArkTask,
  validateArkTaskId,
} from "../../../../_lib/ark-video";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const task = await getArkTask(validateArkTaskId(id));
    return Response.json(task, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return arkErrorResponse(error);
  }
}
