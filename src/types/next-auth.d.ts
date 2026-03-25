import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Internal DB user UUID */
      id: string;
    } & DefaultSession["user"];
  }
}
