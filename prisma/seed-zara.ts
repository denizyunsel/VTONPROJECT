import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const zara = await prisma.brand.upsert({
    where: { slug: "zara" },
    update: {},
    create: {
      name: "Zara",
      slug: "zara",
      promptEndpoint: "https://brand-prompt-generator-phi.vercel.app/api/brands/zara/generate",
    },
  });
  console.log(`Brand: ${zara.name} (${zara.id})`);

  const passwordHash = await bcrypt.hash("test123", 10);
  const user = await prisma.user.upsert({
    where: { email: "test@zara.com" },
    update: {},
    create: {
      email: "test@zara.com",
      passwordHash,
      brandId: zara.id,
    },
  });
  console.log(`User: ${user.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
