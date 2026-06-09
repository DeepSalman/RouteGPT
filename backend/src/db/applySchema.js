import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const schemaPath = fileURLToPath(new URL("../../db/schema.sql", import.meta.url));

async function applySchema() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to apply the database schema.");
  }

  const sql = await readFile(schemaPath, "utf8");
  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await client.query(sql);
  } finally {
    await client.end();
  }

  console.log("Database schema applied successfully.");
}

applySchema().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
