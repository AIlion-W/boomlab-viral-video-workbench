import {
  analyzeVideo,
  viralAgentErrorResponse,
  ViralAgentError,
} from "../../../_lib/viral-agent";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const video = form.get("video");
    if (!(video instanceof File)) {
      throw new ViralAgentError(400, "VIDEO_REQUIRED", "请先上传参考视频。");
    }
    const durationSeconds = Number(form.get("durationSeconds"));
    const performanceData = form.get("performanceData");
    if (performanceData !== null && typeof performanceData !== "string") {
      throw new ViralAgentError(
        400,
        "INVALID_PERFORMANCE_DATA",
        "后台数据说明格式不正确。",
      );
    }
    const analysis = await analyzeVideo({
      file: video,
      durationSeconds,
      performanceData: performanceData ?? "",
    });
    return Response.json({ analysis }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return viralAgentErrorResponse(error);
  }
}
