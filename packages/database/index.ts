import 'server-only';

import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { env } from '@repo/env';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

declare global {
  var cachedPrisma: PrismaClient | undefined;
}

const connectionString = env.POSTGRES_DATABASE_URL as string;
const adapter = new PrismaNeon({ connectionString });

export const database = new PrismaClient({ adapter });

export type {
  Account,
  Prisma,
  Session,
  Subscription,
  Template,
  UsageEvent,
  User,
  Verification
} from '@prisma/client';

