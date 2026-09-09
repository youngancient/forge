import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// No self-serve signup exists by design (design.md decision #7) — this is
// the only way accounts get created. Override the default passwords via
// env vars for anything beyond local/demo use.
const USERS = [
  {
    name: "Sam Salesperson",
    email: "salesperson@forge.dev",
    role: "SALESPERSON" as const,
    password: process.env.SEED_SALESPERSON_PASSWORD ?? "password123",
  },
  {
    name: "Morgan Manager",
    email: "manager@forge.dev",
    role: "MANAGER" as const,
    password: process.env.SEED_MANAGER_PASSWORD ?? "password123",
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
