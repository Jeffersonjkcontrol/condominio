import type { Papel } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    papel: Papel;
    podeUsarIA?: boolean;
  }
  interface Session {
    user: {
      id: string;
      papel: Papel;
      podeUsarIA: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    papel: Papel;
    podeUsarIA?: boolean;
  }
}
