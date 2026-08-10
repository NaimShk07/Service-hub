import "dotenv/config";
import { PrismaClient, ServiceMode } from "@prisma-client/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

async function main() {
  console.log("🌱 Starting database seed...");

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  const categories = [
    {
      name: "Tutor",
      slug: "tutor",
      displayOrder: 1,
    },
    {
      name: "Electrician",
      slug: "electrician",
      displayOrder: 2,
    },
    {
      name: "Tailor",
      slug: "tailor",
      displayOrder: 3,
    },
    {
      name: "Plumber",
      slug: "plumber",
      displayOrder: 4,
    },
    {
      name: "Salon",
      slug: "salon",
      displayOrder: 5,
    },
  ];

  const categoryMap = new Map<string, string>();

  for (const category of categories) {
    const result = await prisma.category.upsert({
      where: {
        slug: category.slug,
      },
      update: {},
      create: {
        name: category.name,
        slug: category.slug,
        displayOrder: category.displayOrder,
        isActive: true,
      },
    });

    categoryMap.set(category.name, result.id);

    console.log(`✓ Category: ${category.name}`);
  }

  // ---------------------------------------------------------------------------
  // Services
  // ---------------------------------------------------------------------------

  const services = [
    // Tutor
    {
      categoryName: "Tutor",
      name: "Mathematics",
      serviceMode: [ServiceMode.ONLINE, ServiceMode.AT_CUSTOMER_LOCATION],
      defaultDuration: 60,
    },
    {
      categoryName: "Tutor",
      name: "Physics",
      serviceMode: [ServiceMode.ONLINE, ServiceMode.AT_CUSTOMER_LOCATION],
      defaultDuration: 60,
    },
    {
      categoryName: "Tutor",
      name: "Chemistry",
      serviceMode: [ServiceMode.ONLINE, ServiceMode.AT_CUSTOMER_LOCATION],
      defaultDuration: 60,
    },

    // Electrician
    {
      categoryName: "Electrician",
      name: "AC Repair",
      serviceMode: [ServiceMode.AT_CUSTOMER_LOCATION],
      defaultDuration: 90,
    },
    {
      categoryName: "Electrician",
      name: "Home Wiring",
      serviceMode: [ServiceMode.AT_CUSTOMER_LOCATION],
      defaultDuration: 120,
    },

    // Tailor
    {
      categoryName: "Tailor",
      name: "Pant Stitching",
      serviceMode: [ServiceMode.AT_PROVIDER_LOCATION],
      defaultDuration: 45,
    },
    {
      categoryName: "Tailor",
      name: "Shirt Stitching",
      serviceMode: [ServiceMode.AT_PROVIDER_LOCATION],
      defaultDuration: 45,
    },
  ];

  for (const service of services) {
    const categoryId = categoryMap.get(service.categoryName);

    if (!categoryId) {
      throw new Error(`Category "${service.categoryName}" was not found.`);
    }

    await prisma.service.upsert({
      where: {
        categoryId_name: {
          categoryId,
          name: service.name,
        },
      },
      update: {},
      create: {
        categoryId,
        name: service.name,
        slug: generateSlug(service.name),
        serviceMode: ServiceMode.ONLINE,
        defaultDuration: service.defaultDuration,
        isActive: true,
      },
    });

    console.log(`  ✓ Service: ${service.categoryName} → ${service.name}`);
  }

  console.log("🌱 Database seed completed successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("❌ Database seed failed:", error);

    await prisma.$disconnect();
    process.exit(1);
  });
