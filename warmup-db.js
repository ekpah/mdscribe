const { sql } = require("@vercel/postgres");

async function warmupDatabase() {
  try {
    await sql`SELECT 1`;
    console.log("Database warmed up successfully");
  } catch (error) {
    console.error("Error warming up database:", error);
  }
}

warmupDatabase();
