import {
  assertArkConfigured,
  arkErrorResponse,
  createArkTask,
  parseCreateArkTaskInput,
} from "../../../_lib/ark-video";
import { productImageDataUrl } from "../../../_lib/ark-image";

async function parseRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return parseCreateArkTaskInput(await request.json());
  }

  const form = await request.formData();
  assertArkConfigured();
  const validated = parseCreateArkTaskInput({
    prompt: form.get("prompt"),
    imageUrls: ["https://product-image.invalid/reference.jpg"],
    ratio: form.get("ratio"),
    duration: form.get("duration"),
    generateAudio: form.get("generateAudio") !== "false",
  });
  const productImageUrl = await productImageDataUrl(form.get("productImage"));
  return { ...validated, imageUrls: [productImageUrl] };
}

export async function POST(request: Request) {
  try {
    const input = await parseRequest(request);
    const task = await createArkTask(input);
    return Response.json(
      { ...task, status: "queued" },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return arkErrorResponse(error);
  }
}
