import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, createUser } from "@/src/models/users";
import { hashPassword } from "@/src/utils/password";
import { errorResponse } from "@/src/utils/api-helpers";
import { logger } from "@/src/utils/logger";

const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
});

/** POST /api/auth/register — create a new user account */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body: unknown = await req.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { email, password } = parsed.data;

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return errorResponse("An account with this email already exists", 409);
    }

    const passwordHash = await hashPassword(password);
    await createUser({ email, passwordHash });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    logger.error({ err, email }, "Failed to register user");
    return errorResponse("Registration failed. Please try again.", 500);
  }
}
