import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type NewUser, type User } from "@/db/schema";

/**
 * Find a user by their email address. Returns null if not found.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Create a new user record. Used during registration.
 */
export async function createUser(data: NewUser): Promise<User> {
  const result = await db.insert(users).values(data).returning();
  return result[0];
}
