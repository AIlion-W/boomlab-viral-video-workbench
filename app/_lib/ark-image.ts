import { ArkRouteError } from "./ark-video";

const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validateProductImage(value: unknown): File {
  if (!(value instanceof File) || value.size === 0) {
    throw new ArkRouteError(400, "PRODUCT_IMAGE_REQUIRED", "请先上传产品白底图。");
  }
  if (!ALLOWED_IMAGE_TYPES.has(value.type)) {
    throw new ArkRouteError(
      400,
      "INVALID_PRODUCT_IMAGE",
      "产品白底图仅支持 JPG、PNG 或 WebP。",
    );
  }
  if (value.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ArkRouteError(
      413,
      "PRODUCT_IMAGE_TOO_LARGE",
      "产品白底图不能超过 10MB。",
    );
  }
  return value;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
    );
  }
  return btoa(chunks.join(""));
}

export async function productImageDataUrl(value: unknown): Promise<string> {
  const file = validateProductImage(value);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return `data:${file.type};base64,${bytesToBase64(bytes)}`;
}
