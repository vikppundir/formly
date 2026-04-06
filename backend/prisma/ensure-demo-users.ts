/**
 * Create or update demo admin + standard user with known passwords (local/dev).
 * Requires roles from seed: run `npm run db:seed` once if roles are missing.
 *
 * Passwords: DEMO_ADMIN_PASSWORD / DEMO_USER_PASSWORD (or defaults below).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const ADMIN_EMAIL = (process.env.DEMO_ADMIN_EMAIL || "admin@example.com").toLowerCase().trim();
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || "Admin@Dev2026!";
const USER_EMAIL = (process.env.DEMO_USER_EMAIL || "user@example.com").toLowerCase().trim();
const USER_PASSWORD = process.env.DEMO_USER_PASSWORD || "User@Dev2026!";

async function main() {
  const prisma = new PrismaClient();
  try {
    const superAdminRole = await prisma.role.findUnique({ where: { name: "Super Admin" } });
    const userRole = await prisma.role.findUnique({ where: { name: "User" } });
    if (!superAdminRole || !userRole) {
      console.error("Roles missing. Run: npm run db:seed");
      process.exit(1);
    }

    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const userHash = await bcrypt.hash(USER_PASSWORD, 12);

    const admin = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        password: adminHash,
        emailVerified: true,
        status: "ACTIVE",
        deletedAt: null,
      },
      create: {
        email: ADMIN_EMAIL,
        name: "Demo Admin",
        password: adminHash,
        emailVerified: true,
        status: "ACTIVE",
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: superAdminRole.id },
    });

    const user = await prisma.user.upsert({
      where: { email: USER_EMAIL },
      update: {
        password: userHash,
        emailVerified: true,
        status: "ACTIVE",
        deletedAt: null,
      },
      create: {
        email: USER_EMAIL,
        name: "Demo User",
        password: userHash,
        emailVerified: true,
        status: "ACTIVE",
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: userRole.id } },
      update: {},
      create: { userId: user.id, roleId: userRole.id },
    });

    console.log("Demo access ready:");
    console.log(`  Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log(`  User:  ${USER_EMAIL} / ${USER_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
