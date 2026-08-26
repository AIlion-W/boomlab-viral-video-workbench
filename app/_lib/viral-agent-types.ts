export type TranscriptSegment = {
  start: string;
  end: string;
  sceneSpeaker: string;
  text: string;
};

export type ShotAnalysis = {
  id: number;
  timeRange: string;
  visual: string;
  people: string;
  purpose: string;
  assessment: string;
  coreConversion: boolean;
  keepOrReplace: string;
};

export type FunnelAnalysis = {
  key: "hook" | "pain" | "trust" | "effect" | "cta";
  label: string;
  strength: "强" | "中" | "弱" | "缺失";
  score: number;
  rationale: string;
};

export type RewriteHandoff = {
  originalStyle: string;
  originalContentType: string;
  narrativeSkeleton: string;
  emotionalCurve: string;
  openingHook: string;
  coreConversionShot: string;
  mustKeep: string;
  mustReplace: string;
  replaceableDimensions: string;
  targetProduct: string;
  primarySellingPoint: string;
  secondarySellingPoint: string;
  painOpening: string;
  effectDemo: string;
  dataEvidence: string;
  cta: string;
  complianceNotes: string;
};

export type RewriteOptions = {
  style: string;
  contentType: string;
  preserve: string[];
  shotDecision: string;
  primarySellingPoint: string;
  secondarySellingPoint: string;
  painOpening: string;
  scene: string;
  durationSeconds: number;
  variantCount: 1 | 3;
};

export type AnalysisResult = {
  style: {
    visualStyle: string;
    contentTypes: string[];
    categoryCoverageNote: string;
  };
  transcript: TranscriptSegment[];
  transcriptNote: string;
  overview: {
    brandProduct: string;
    durationSeconds: number;
    pace: string;
    mixedEdit: boolean;
    purpose: string;
  };
  shots: ShotAnalysis[];
  funnel: FunnelAnalysis[];
  hookAnalysis: {
    hookType: string;
    audience: string;
    impactSource: string;
    reasonToContinue: string;
    conversionReasons: string[];
  };
  strengths: string[];
  improvements: string[];
  complianceWarnings: string[];
  dataReview: {
    provided: boolean;
    summary: string;
    attribution: string;
    notice: string;
  };
  scores: {
    hook: number;
    pain: number;
    trust: number;
    effect: number;
    cta: number;
    pace: number;
    total: number;
    subjective: boolean;
    note: string;
  };
  fractureSkeleton: {
    coreConversionShot: string;
    variables: string[];
    matrix: string;
    formula: string;
    transferableCategories: string[];
  };
  handoff: RewriteHandoff;
  defaults: RewriteOptions;
};

export type RewriteShot = {
  title: string;
  timeRange: string;
  camera: string;
  visual: string;
  audio: string;
  transition: string;
};

export type RewriteVariant = {
  id: string;
  title: string;
  positioning: string;
  basicSetting: string;
  shots: RewriteShot[];
  complianceChecks: Array<{
    label: string;
    status: "通过" | "存疑";
    detail: string;
  }>;
  reminders: string[];
  seedancePrompt: string;
};

export type RewriteResponse = {
  variants: RewriteVariant[];
};
