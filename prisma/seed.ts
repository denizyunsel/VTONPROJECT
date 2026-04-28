import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Brand: Koton
  const koton = await prisma.brand.upsert({
    where: { slug: "koton" },
    update: {},
    create: {
      name: "Koton",
      slug: "koton",
      promptEndpoint:
        "https://prompt-gen.example.com/api/brands/koton/generate",
    },
  });
  console.log(`Brand created: ${koton.name}`);

  // AI Models
  const model1 = await prisma.aIModel.upsert({
    where: { id: "model-001" },
    update: {},
    create: {
      id: "model-001",
      name: "Sofia",
      imageUrl:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200",
    },
  });

  const model2 = await prisma.aIModel.upsert({
    where: { id: "model-002" },
    update: {},
    create: {
      id: "model-002",
      name: "Mia",
      imageUrl:
        "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200",
    },
  });
  console.log(`AI Models created: ${model1.name}, ${model2.name}`);

  // Brand <-> Model access
  await prisma.brandModel.upsert({
    where: { brandId_modelId: { brandId: koton.id, modelId: model1.id } },
    update: {},
    create: { brandId: koton.id, modelId: model1.id },
  });
  await prisma.brandModel.upsert({
    where: { brandId_modelId: { brandId: koton.id, modelId: model2.id } },
    update: {},
    create: { brandId: koton.id, modelId: model2.id },
  });

  // Style Assets
  const styleAssets = [
    {
      id: "asset-light-1",
      type: "LIGHTING" as const,
      label: "Soft Natural Light",
      imageUrl:
        "https://images.unsplash.com/photo-1517685352821-92cf88aee5a5?w=300",
    },
    {
      id: "asset-light-2",
      type: "LIGHTING" as const,
      label: "Studio Light",
      imageUrl:
        "https://images.unsplash.com/photo-1536240478700-b869ad10e9eb?w=300",
    },
    {
      id: "asset-pose-1",
      type: "POSE" as const,
      label: "Standing Front",
      imageUrl:
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300",
    },
    {
      id: "asset-pose-2",
      type: "POSE" as const,
      label: "Walking Pose",
      imageUrl:
        "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300",
    },
    {
      id: "asset-bg-1",
      type: "BACKGROUND" as const,
      label: "White Studio",
      imageUrl:
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300",
    },
    {
      id: "asset-style-1",
      type: "COMPOSITION" as const,
      label: "Editorial",
      imageUrl:
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300",
    },
  ];

  for (const asset of styleAssets) {
    await prisma.styleAsset.upsert({
      where: { id: asset.id },
      update: {},
      create: {
        id: asset.id,
        brandId: koton.id,
        type: asset.type,
        label: asset.label,
        imageUrl: asset.imageUrl,
      },
    });
  }
  console.log(`Style assets created: ${styleAssets.length}`);

  // Test User
  const passwordHash = await bcrypt.hash("test123", 10);
  const user = await prisma.user.upsert({
    where: { email: "test@koton.com" },
    update: {},
    create: {
      email: "test@koton.com",
      passwordHash,
      brandId: koton.id,
    },
  });
  console.log(`User created: ${user.email}`);

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

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
