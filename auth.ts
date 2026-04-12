import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { findUserByEmail } from "@/src/models/users";
import { verifyPassword } from "@/src/utils/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(8),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const user = await findUserByEmail(parsed.data.email);
        if (!user) return null;

        const valid = await verifyPassword(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
