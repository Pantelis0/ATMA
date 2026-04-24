import { env } from "../config/env.js";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __atmaPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__atmaPrisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL
      }
    },
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__atmaPrisma = prisma;
}
