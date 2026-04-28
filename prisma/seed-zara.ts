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

  // Ensure AI models exist
  const model1 = await prisma.aIModel.upsert({
    where: { id: "model-001" },
    update: {},
    create: {
      id: "model-001",
      name: "Sofia",
      imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800",
      thumbnailUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200",
    },
  });
  const model2 = await prisma.aIModel.upsert({
    where: { id: "model-002" },
    update: {},
    create: {
      id: "model-002",
      name: "Mia",
      imageUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800",
      thumbnailUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200",
    },
  });

  // Brand <-> Model access
  await prisma.brandModel.upsert({
    where: { brandId_modelId: { brandId: zara.id, modelId: model1.id } },
    update: {},
    create: { brandId: zara.id, modelId: model1.id },
  });
  await prisma.brandModel.upsert({
    where: { brandId_modelId: { brandId: zara.id, modelId: model2.id } },
    update: {},
    create: { brandId: zara.id, modelId: model2.id },
  });

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

  // User <-> Model access
  await prisma.userModelAccess.upsert({
    where: { userId_modelId: { userId: user.id, modelId: model1.id } },
    update: {},
    create: { userId: user.id, modelId: model1.id },
  });
  await prisma.userModelAccess.upsert({
    where: { userId_modelId: { userId: user.id, modelId: model2.id } },
    update: {},
    create: { userId: user.id, modelId: model2.id },
  });
  console.log(`Models assigned: ${model1.name}, ${model2.name}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
