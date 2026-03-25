import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB models before importing service ──────────────────────────────────
vi.mock("@/src/models/onboarding", () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  getActiveSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  saveProfile: vi.fn(),
}));

vi.mock("@/src/models/users", () => ({
  upsertUser: vi.fn(),
  findUserByClerkId: vi.fn(),
}));

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

import Anthropic from "@anthropic-ai/sdk";
import {
  startSession,
  processResponse,
  confirmProfile,
  restartSession,
} from "@/src/services/onboarding-agent";
import * as onboardingModel from "@/src/models/onboarding";
import type { OnboardingSession } from "@/db/schema";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockSession: OnboardingSession = {
  id: "session-123",
  userId: "user-abc",
  step: 0,
  answers: {},
  clarificationCount: {},
  messages: [],
  isComplete: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function mockAnthropicResponse(text: string) {
  const client = new Anthropic();
  vi.mocked(client.messages.create).mockResolvedValueOnce({
    content: [{ type: "text", text }],
    id: "msg_test",
    model: "claude-sonnet-4-6",
    role: "assistant",
    stop_reason: "end_turn",
    stop_sequence: null,
    type: "message",
    usage: { input_tokens: 10, output_tokens: 20 },
  } as Awaited<ReturnType<typeof client.messages.create>>);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OnboardingAgentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── startSession ────────────────────────────────────────────────────────────

  describe("startSession", () => {
    it("creates a new session when no active session exists", async () => {
      vi.mocked(onboardingModel.getActiveSession).mockResolvedValueOnce(null);
      vi.mocked(onboardingModel.createSession).mockResolvedValueOnce(mockSession);
      vi.mocked(onboardingModel.updateSession).mockResolvedValueOnce(mockSession);

      // Mock Anthropic constructor to return controllable instance
      const mockCreate = vi.fn().mockResolvedValueOnce({
        content: [{ type: "text", text: "Hello! I'm your learning coach." }],
      });
      vi.mocked(Anthropic).mockImplementationOnce(
        () => ({ messages: { create: mockCreate } } as unknown as Anthropic)
      );

      const result = await startSession("user-abc");

      expect(onboardingModel.createSession).toHaveBeenCalledWith("user-abc");
      expect(result.sessionId).toBe("session-123");
      expect(result.message).toBe("Hello! I'm your learning coach.");
    });

    it("resumes an existing incomplete session", async () => {
      const sessionWithMessages: OnboardingSession = {
        ...mockSession,
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "What is your role?" },
        ],
      };
      vi.mocked(onboardingModel.getActiveSession).mockResolvedValueOnce(sessionWithMessages);

      const result = await startSession("user-abc");

      expect(onboardingModel.createSession).not.toHaveBeenCalled();
      expect(result.message).toBe("What is your role?");
    });
  });

  // ── processResponse ─────────────────────────────────────────────────────────

  describe("processResponse", () => {
    it("processes a clear answer and advances step", async () => {
      const session: OnboardingSession = {
        ...mockSession,
        messages: [{ role: "assistant", content: "What is your role?" }],
      };
      vi.mocked(onboardingModel.getSession).mockResolvedValueOnce(session);
      vi.mocked(onboardingModel.updateSession).mockResolvedValueOnce({
        ...session,
        step: 1,
      });

      const mockCreate = vi.fn().mockResolvedValueOnce({
        content: [{ type: "text", text: "Great! Now what topics interest you?" }],
      });
      vi.mocked(Anthropic).mockImplementationOnce(
        () => ({ messages: { create: mockCreate } } as unknown as Anthropic)
      );

      const result = await processResponse("session-123", "I am a software engineer");

      expect(result.message).toBe("Great! Now what topics interest you?");
      expect(result.isComplete).toBe(false);
    });

    it("detects vague answer and stays on same step", async () => {
      const session: OnboardingSession = {
        ...mockSession,
        step: 1,
        messages: [{ role: "assistant", content: "What topics interest you?" }],
      };
      vi.mocked(onboardingModel.getSession).mockResolvedValueOnce(session);
      vi.mocked(onboardingModel.updateSession).mockResolvedValueOnce(session);

      const mockCreate = vi.fn().mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "No worries! Here are some examples: AI/ML, Cloud Computing, Web Development. Which resonates?",
          },
        ],
      });
      vi.mocked(Anthropic).mockImplementationOnce(
        () => ({ messages: { create: mockCreate } } as unknown as Anthropic)
      );

      const result = await processResponse("session-123", "not sure");

      // updateSession called with same step (1), clarificationCount incremented
      const updateCall = vi.mocked(onboardingModel.updateSession).mock.calls[0];
      expect(updateCall[1].step).toBe(1); // stayed on same step
      expect(result.isComplete).toBe(false);
    });

    it("marks session complete when Claude emits PROFILE_COMPLETE", async () => {
      const profileJson = JSON.stringify({
        role: "Software Engineer",
        interests: [{ topic: "AI", depth: "deep dive into LLMs", keywords: ["LLM", "RAG"] }],
        aspirations: [{ goal: "Build AI products", priority: 1 }],
        knowledgeLevel: [{ topic: "AI", level: "intermediate" }],
        motivation: "Stay ahead of the curve",
      });

      const session: OnboardingSession = {
        ...mockSession,
        step: 5,
        messages: [{ role: "assistant", content: "Does this summary look right?" }],
      };
      vi.mocked(onboardingModel.getSession).mockResolvedValueOnce(session);
      vi.mocked(onboardingModel.updateSession).mockResolvedValueOnce({
        ...session,
        isComplete: true,
      });

      const mockCreate = vi.fn().mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: `Great, confirmed!\nPROFILE_COMPLETE:\n${profileJson}`,
          },
        ],
      });
      vi.mocked(Anthropic).mockImplementationOnce(
        () => ({ messages: { create: mockCreate } } as unknown as Anthropic)
      );

      const result = await processResponse("session-123", "yes");

      expect(result.isComplete).toBe(true);
      expect(result.profileData?.role).toBe("Software Engineer");
    });

    it("throws if session not found", async () => {
      vi.mocked(onboardingModel.getSession).mockResolvedValueOnce(null);
      await expect(processResponse("bad-id", "hello")).rejects.toThrow("Session bad-id not found");
    });

    it("throws if session already complete", async () => {
      vi.mocked(onboardingModel.getSession).mockResolvedValueOnce({
        ...mockSession,
        isComplete: true,
      });
      await expect(processResponse("session-123", "hello")).rejects.toThrow(
        "Session is already complete"
      );
    });

    it("propagates Claude API failure after retries", async () => {
      const session: OnboardingSession = { ...mockSession, messages: [] };
      vi.mocked(onboardingModel.getSession).mockResolvedValueOnce(session);

      const mockCreate = vi.fn().mockRejectedValue(new Error("API rate limit"));
      vi.mocked(Anthropic).mockImplementationOnce(
        () => ({ messages: { create: mockCreate } } as unknown as Anthropic)
      );

      await expect(processResponse("session-123", "hello")).rejects.toThrow();
    });
  });

  // ── confirmProfile ──────────────────────────────────────────────────────────

  describe("confirmProfile", () => {
    it("saves profile and marks session complete", async () => {
      vi.mocked(onboardingModel.saveProfile).mockResolvedValueOnce({} as never);
      vi.mocked(onboardingModel.updateSession).mockResolvedValueOnce({} as never);

      const profileData = {
        role: "Engineer",
        interests: [{ topic: "AI", depth: "deep", keywords: [] }],
        aspirations: [],
        knowledgeLevel: [],
        motivation: "Learn more",
      };

      await expect(
        confirmProfile("session-123", "user-abc", profileData)
      ).resolves.toBeUndefined();

      expect(onboardingModel.saveProfile).toHaveBeenCalledWith("user-abc", profileData);
      expect(onboardingModel.updateSession).toHaveBeenCalledWith("session-123", {
        isComplete: true,
      });
    });
  });

  // ── restartSession ──────────────────────────────────────────────────────────

  describe("restartSession", () => {
    it("deletes old session and starts fresh", async () => {
      vi.mocked(onboardingModel.deleteSession).mockResolvedValueOnce(undefined);
      vi.mocked(onboardingModel.getActiveSession).mockResolvedValueOnce(null);
      vi.mocked(onboardingModel.createSession).mockResolvedValueOnce(mockSession);
      vi.mocked(onboardingModel.updateSession).mockResolvedValueOnce(mockSession);

      const mockCreate = vi.fn().mockResolvedValueOnce({
        content: [{ type: "text", text: "Let's start fresh!" }],
      });
      vi.mocked(Anthropic).mockImplementationOnce(
        () => ({ messages: { create: mockCreate } } as unknown as Anthropic)
      );

      const result = await restartSession("session-123", "user-abc");

      expect(onboardingModel.deleteSession).toHaveBeenCalledWith("session-123");
      expect(result.sessionId).toBe("session-123");
    });
  });
});
