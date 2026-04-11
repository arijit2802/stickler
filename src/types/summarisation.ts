// ─── Blog Summarisation & Learning Shorts — Type Definitions ───────────────────

/** A single keyword extracted from a blog post. */
export interface Keyword {
  term: string;
  definition: string;
}

/** Full summarisation output for a blog post. */
export interface SummaryOutput {
  summaryBullets: string[];
  keywords: Keyword[];
  learningShort: string;
}

/** Response from GET /api/blogs/:id/summary */
export interface GetSummaryResponse {
  blogId: string;
  status: "none" | "processing" | "done" | "unprocessable";
  summaryBullets: string[];
  keywords: Keyword[];
  learningShort: string | null;
  audioUrl: string | null;
  audioStatus: "none" | "generating" | "done" | "failed";
  interviewAudioUrl: string | null;
  interviewAudioStatus: "none" | "generating" | "done" | "failed";
  interviewScript: string | null;
  processedAt: string | null;
}

/** Response from POST /api/blogs/:id/process */
export interface ProcessBlogResponse {
  blogId: string;
  status: "done" | "unprocessable";
}

/** Response from GET /api/blogs/:id/audio */
export interface GetAudioResponse {
  audioUrl: string | null;
  audioStatus: "none" | "generating" | "done" | "failed";
  script: string | null;
}

/** Response from GET /api/blogs/:id/interview */
export interface GetInterviewResponse {
  interviewAudioUrl: string | null;
  interviewAudioStatus: "none" | "generating" | "done" | "failed";
  interviewScript: string | null;
}

/** One parsed segment of an interview script */
export interface InterviewSegment {
  speaker: "JANE" | "AUTHOR";
  text: string;
}
