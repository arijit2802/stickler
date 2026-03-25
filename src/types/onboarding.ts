// ─── Session State ────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SessionState {
  sessionId: string;
  userId: string;
  step: number;
  answers: Record<string, string>;
  clarificationCount: Record<string, number>;
  messages: ConversationMessage[];
  isComplete: boolean;
}

// ─── Learning Profile ─────────────────────────────────────────────────────────

export interface InterestItem {
  topic: string;
  depth: string;
  keywords: string[];
}

export interface AspirationItem {
  goal: string;
  priority: number;
}

export interface KnowledgeLevelItem {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
}

export interface LearningProfileData {
  role: string;
  interests: InterestItem[];
  aspirations: AspirationItem[];
  knowledgeLevel: KnowledgeLevelItem[];
  motivation: string;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface StartSessionResponse {
  sessionId: string;
  message: string; // First greeting from Claude
}

export interface RespondPayload {
  sessionId: string;
  message: string;
}

export interface RespondResponse {
  message: string; // Claude's next question or summary
  isComplete: boolean;
  profileData?: LearningProfileData; // Populated when isComplete = true
}

export interface ConfirmPayload {
  sessionId: string;
  profileData: LearningProfileData;
}

export interface UpdateProfilePayload {
  role?: string;
  interests?: InterestItem[];
  aspirations?: AspirationItem[];
  knowledgeLevel?: KnowledgeLevelItem[];
  motivation?: string;
}
