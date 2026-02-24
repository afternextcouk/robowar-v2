import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { connectDB, getPool } from "./index";
import logger from "../config/logger";

async function migrate() {
  await connectDB();
  const pool = getPool();

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query(
      "SELECT id FROM _migrations WHERE filename = $1",
      [file]
    );
    if (rows.length > 0) {
      logger.info(`  ⏭  Skipping ${file} (already ran)`);
      continue;
    }

    logger.info(`  ▶  Running ${file}`);
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await pool.query(sql);
    await pool.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
    logger.info(`  ✅ ${file} complete`);
  }

  logger.info("🎉 All migrations complete");
  process.exit(0);
}

migrate().catch((err) => {
  logger.error("Migration failed:", err);
  process.exit(1);
});
