import { PrismaClient, Role, RecordType } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const ALLOWED_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Rent",
  "Food",
  "Transport",
  "Utilities",
  "Entertainment",
  "Healthcare",
  "Shopping",
] as const;

async function main() {
  const password = await bcrypt.hash("Password@123456", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@finance.com" },
    update: {},
    create: {
      email: "admin@finance.com",
      password,
      name: "Admin",
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "analyst@finance.com" },
    update: {},
    create: {
      email: "analyst@finance.com",
      password,
      name: "Analyst",
      role: Role.ANALYST,
    },
  });

  await prisma.user.upsert({
    where: { email: "viewer@finance.com" },
    update: {},
    create: {
      email: "viewer@finance.com",
      password,
      name: "Viewer",
      role: Role.VIEWER,
    },
  });

  const records = Array.from({ length: 30 }).map((_, i) => {
    // Inject anomalies manually based on requirements
    if (i === 15) {
      return {
        amount: 70000,
        type: RecordType.EXPENSE,
        category: "Entertainment",
        date: new Date(),
        createdById: admin.id,
        notes: "Intentional massive anomaly",
      };
    }

    if (i === 16 || i === 17) {
      return {
        amount: 550,
        type: RecordType.EXPENSE,
        category: i === 16 ? "Food" : "Transport",
        date: new Date(),
        createdById: admin.id,
        notes: "Intentional duplicate cross-category anomaly",
      };
    }

    const type = Math.random() > 0.6 ? RecordType.INCOME : RecordType.EXPENSE;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - Math.floor(Math.random() * 180));

    return {
      amount: Math.floor(Math.random() * 5000) + 50,
      type,
      category:
        ALLOWED_CATEGORIES[
          Math.floor(Math.random() * ALLOWED_CATEGORIES.length)
        ],
      date: pastDate,
      createdById: admin.id,
    };
  });

  for (const r of records) {
    await prisma.financialRecord.create({ data: r });
  }

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
