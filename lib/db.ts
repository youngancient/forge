import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 has no bundled query engine — a driver adapter is required.
// Use Neon's pooled connection string for DATABASE_URL (PgBouncer-backed),
// which works fine with a standard pg adapter under the Node.js runtime
// we run in (design.md decision #11 — no edge functions here).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
