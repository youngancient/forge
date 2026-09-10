import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// No self-serve signup exists by design (design.md decision #7) — this is
// the only way accounts get created. Passwords must come from env vars;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} — refusing to seed with a fallback password.`);
  }
  return value;
}

const USERS = [
  {
    name: "Jude",
    email: "jude@forge.com",
    role: "SALESPERSON" as const,
    password: requireEnv("SEED_SALESPERSON_PASSWORD"),
  },
  {
    name: "Tofunmi",
    email: "tofunmi@forge.com",
    role: "SALESPERSON" as const,
    password: requireEnv("SEED_SALESPERSON_PASSWORD"),
  },
  {
    name: "Morgan Manager",
    email: "morgan@forge.com",
    role: "MANAGER" as const,
    password: requireEnv("SEED_MANAGER_PASSWORD"),
  },
];

async function main() {
  for (const user of USERS) {
    const passwordHash = await hashPassword(user.password);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        passwordHash,
      },
    });
    console.log(`Seeded ${user.role.toLowerCase()}: ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
