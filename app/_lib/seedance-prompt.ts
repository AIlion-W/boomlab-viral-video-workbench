const PRODUCT_REFERENCE = "__BOOMLAB_PRODUCT_REFERENCE__";

export function normalizeSingleProductPrompt(
  value: string,
  productReference = "@产品图",
): string {
  return value
    .replace(
      /@[\p{Script=Han}A-Za-z0-9_-]*产品[\p{Script=Han}A-Za-z0-9_-]*图/gu,
      PRODUCT_REFERENCE,
    )
    .replace(/@[\p{Script=Han}A-Za-z0-9_-]+图/gu, "")
    .replaceAll(PRODUCT_REFERENCE, productReference)
    .replace(/3D\s*皮克斯(?:式)?(?:动画)?(?:渲染)?/g, "圆润的高品质三维动画电影渲染")
    .replace(/皮克斯(?:式)?(?:动画)?(?:渲染)?/g, "圆润的高品质三维动画电影渲染")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
