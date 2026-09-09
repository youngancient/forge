import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

// next-auth/jwt just re-exports @auth/core/jwt's JWT interface — augment the
// original module too, since that's what the library's own callback types
// resolve against internally.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
