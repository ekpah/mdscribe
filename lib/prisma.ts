import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

import ws from "ws";

neonConfig.webSocketConstructor = ws;
const connectionString = `${process.env.POSTGRES_PRISMA_URL}`;

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

/*if (process.env.NODE_ENV === "production") {
  const neon = new Pool({
    connectionString: process.env.POSTGRES_PRISMA_URL,
  });
  const adapter = new PrismaNeon(neon);
  const prisma = new PrismaClient({ adapter });
} else {
  if (!global.prisma) {
    const neon = new Pool({
      connectionString: process.env.POSTGRES_PRISMA_URL,
    });
    const adapter = new PrismaNeon(neon);
    global.prisma = new PrismaClient({ adapter });
  }
  prisma = global.prisma;
}*/

export default prisma;
