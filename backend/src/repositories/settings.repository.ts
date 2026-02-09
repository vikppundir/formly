import { PrismaClient } from "@prisma/client";

export function createSettingsRepository(prisma: PrismaClient) {
  return {
    // Get all settings
    async getAll() {
      return prisma.appSettings.findMany({
        orderBy: { category: "asc" },
      });
    },

    // Get settings by category
    async getByCategory(category: string) {
      return prisma.appSettings.findMany({
        where: { category },
      });
    },

    // Get single setting
    async get(key: string) {
      return prisma.appSettings.findUnique({ where: { key } });
    },

    // Get setting value with default
    async getValue(key: string, defaultValue = "") {
      const setting = await prisma.appSettings.findUnique({ where: { key } });
      return setting?.value ?? defaultValue;
    },

    // Update or create setting
    async set(key: string, value: string, category?: string) {
      return prisma.appSettings.upsert({
        where: { key },
        update: { value },
        create: { key, value, category: category ?? "general" },
      });
    },

    // Bulk update settings (upsert to handle new keys)
    async bulkUpdate(settings: { key: string; value: string }[]) {
      const operations = settings.map((s) =>
        prisma.appSettings.upsert({
          where: { key: s.key },
          update: { value: s.value },
          create: { key: s.key, value: s.value, category: s.key.split("_")[0] ?? "general" },
        })
      );
      return prisma.$transaction(operations);
    },
  };
}
