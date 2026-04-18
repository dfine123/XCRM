import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __xcrmPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__xcrmPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__xcrmPrisma = prisma;
}
