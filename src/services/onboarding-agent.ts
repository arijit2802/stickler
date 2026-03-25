import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/src/utils/logger";
import {
  createSession,
  getSession,
  updateSession,
  getActiveSession,
  deleteSession,
  saveProfile as persistProfile,
} from "@/src/models/onboarding";
import type {
  SessionState,
  LearningProfileData,
  ConversationMessage,
  StartSessionResponse,
  RespondResponse,
} from "@/src/types/onboarding";
import type { OnboardingSession } from "@/db/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CLARIFICATIONS = 3;
const VAGUE_TRIGGERS = ["not sure", "anything", "everything", "idk", "no idea", "unsure", "don't know"];

const SYSTEM_PROMPT = `You are an expert learning coach conducting a friendly onboarding interview.
Your goal is to understand the user's professional role, interests, knowledge level, and learning goals
so you can personalise their blog reading recommendations.

Rules:
- Ask ONE focused question at a time. Never bundle multiple questions.
- If the user is vague (e.g. "not sure", "anything", "everything"), offer exactly 3 concrete examples
  as options and ask them to choose or describe their own.
- Never ask more than 3 follow-up questions on the same topic before moving on.
- Keep questions conversational, warm, and encouraging.
- When you have collected: role, interests (with depth), knowledge level per topic, and motivation —
  output a JSON summary block in this exact format, preceded by the text "PROFILE_COMPLETE:":

PROFILE_COMPLETE:
{
  "role": "string",
  "interests": [{ "topic": "string", "depth": "string", "keywords": ["string"] }],
  "aspirations": [{ "goal": "string", "priority": 1 }],
  "knowledgeLevel": [{ "topic": "string", "level": "beginner|intermediate|advanced" }],
  "motivation": "string"
}

Before outputting PROFILE_COMPLETE, show the user a plain-English summary and ask them to confirm
with "yes" or request changes. Only output PROFILE_COMPLETE after they confirm.`;

// ─── Client ───────────────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map DB session row to the in-memory SessionState shape.
 */
function toSessionState(row: OnboardingSession): SessionState {
  return {
    sessionId: row.id,
    userId: row.userId,
    step: row.step,
    answers: (row.answers as Record<string, string>) ?? {},
    clarificationCount: (row.clarificationCount as Record<string, number>) ?? {},
    messages: (row.messages as ConversationMessage[]) ?? [],
    isComplete: row.isComplete ?? false,
  };
}

/**
 * Detect whether a user message is too vague to proceed without clarification.
 */
function isVague(message: string): boolean {
  const lower = message.toLowerCase().trim();
  if (lower.split(" ").length < 5) return true; // Very short answer
  return VAGUE_TRIGGERS.some((trigger) => lower.includes(trigger));
}

/**
 * Parse the PROFILE_COMPLETE JSON block from Claude's response.
 * Returns null if not present.
 */
function parseProfileFromResponse(content: string): LearningProfileData | null {
  const marker = "PROFILE_COMPLETE:";
  const idx = content.indexOf(marker);
  if (idx === -1) return null;

  try {
    const jsonStr = content.slice(idx + marker.length).trim();
    const parsed = JSON.parse(jsonStr) as unknown;

    // Basic structural validation
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("role" in parsed) ||
      !("interests" in parsed)
    ) {
      return null;
    }

    return parsed as LearningProfileData;
  } catch {
    logger.warn("Failed to parse PROFILE_COMPLETE JSON from Claude response");
    return null;
  }
}

/**
 * Call Claude API with retry on transient failure.
 */
async function callClaude(
  client: Anthropic,
  messages: ConversationMessage[],
  retries = 1
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const block = response.content[0];
      if (block.type !== "text") throw new Error("Unexpected response type from Claude");
      return block.text;
    } catch (err) {
      if (attempt === retries) throw err;
      logger.warn({ err, attempt }, "Claude API call failed, retrying...");
    }
  }
  throw new Error("Claude API call exhausted retries");
}

// ─── Public Service API ───────────────────────────────────────────────────────

/**
 * Start a new onboarding session for the user.
 * Resumes an existing incomplete session if one exists.
 */
export async function startSession(userId: string): Promise<StartSessionResponse> {
  // Resume existing session if present
  const existing = await getActiveSession(userId);
  if (existing) {
    const state = toSessionState(existing);
    const lastAssistant = [...state.messages].reverse().find((m) => m.role === "assistant");
    return {
      sessionId: state.sessionId,
      message: lastAssistant?.content ?? "Welcome back! Let's continue where we left off.",
    };
  }

  // Create fresh session
  const session = await createSession(userId);
  const client = getAnthropicClient();

  const greeting = await callClaude(client, [
    {
      role: "user",
      content: "Hi, I'm ready to get started.",
    },
  ]);

  await updateSession(session.id, {
    messages: [
      { role: "user", content: "Hi, I'm ready to get started." },
      { role: "assistant", content: greeting },
    ],
  });

  return { sessionId: session.id, message: greeting };
}

/**
 * Process one user turn: append message, call Claude, persist state.
 */
export async function processResponse(
  sessionId: string,
  userMessage: string
): Promise<RespondResponse> {
  const session = await getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.isComplete) throw new Error("Session is already complete");

  const state = toSessionState(session);

  // Append user message
  const updatedMessages: ConversationMessage[] = [
    ...state.messages,
    { role: "user", content: userMessage },
  ];

  // Track clarification depth for vague answers
  const stepKey = `step_${state.step}`;
  let clarificationCount = { ...state.clarificationCount };
  if (isVague(userMessage)) {
    clarificationCount[stepKey] = (clarificationCount[stepKey] ?? 0) + 1;
  } else {
    // Non-vague answer — advance step
    clarificationCount[stepKey] = 0;
  }

  const client = getAnthropicClient();
  const assistantResponse = await callClaude(client, updatedMessages);

  // Check if Claude has gathered enough and confirmed the profile
  const profileData = parseProfileFromResponse(assistantResponse);
  const isComplete = profileData !== null;

  const newMessages: ConversationMessage[] = [
    ...updatedMessages,
    { role: "assistant", content: assistantResponse },
  ];

  // Advance step unless we're in a clarification loop for this step
  const nextStep =
    (clarificationCount[stepKey] ?? 0) >= MAX_CLARIFICATIONS
      ? state.step + 1 // Force advance after max clarifications
      : isVague(userMessage)
      ? state.step // Stay on same step
      : state.step + 1;

  await updateSession(sessionId, {
    step: nextStep,
    answers: { ...state.answers, [stepKey]: userMessage },
    clarificationCount,
    messages: newMessages,
    isComplete,
  });

  // Strip the JSON block from what the user sees
  const displayMessage = assistantResponse.replace(/PROFILE_COMPLETE:[\s\S]*$/, "").trim();

  return {
    message: displayMessage || assistantResponse,
    isComplete,
    profileData: isComplete ? profileData : undefined,
  };
}

/**
 * Confirm and persist the learning profile.
 * Marks session as complete and saves the profile to DB.
 */
export async function confirmProfile(
  sessionId: string,
  userId: string,
  profileData: LearningProfileData
): Promise<void> {
  await persistProfile(userId, profileData);
  await updateSession(sessionId, { isComplete: true });
}

/**
 * Check whether all required profile fields have been collected.
 */
export function isProfileComplete(state: SessionState): boolean {
  const answers = state.answers;
  return (
    Object.keys(answers).length >= 4 && // At minimum 4 answered steps
    state.isComplete
  );
}

/**
 * Restart the onboarding interview — deletes the current session.
 */
export async function restartSession(sessionId: string, userId: string): Promise<StartSessionResponse> {
  await deleteSession(sessionId);
  return startSession(userId);
}
