import "dotenv/config";
import { connectDB, query } from "../index";
import { ROBOT_SEEDS } from "./robots";
import logger from "../../config/logger";

async function seed() {
  await connectDB();
  logger.info("🌱 Seeding database...");

  // Seed robots
  logger.info(`Seeding ${ROBOT_SEEDS.length} robots...`);
  for (const robot of ROBOT_SEEDS) {
    await query(
      `INSERT INTO robots (slug, display_name, element, tier, sprite_atlas,
         base_hp, base_attack, base_defense, base_speed, base_energy, energy_regen,
         strong_vs, weak_vs, biome_bonus, gmo_cost, is_starter)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (slug) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         base_hp = EXCLUDED.base_hp,
         base_attack = EXCLUDED.base_attack,
         base_defense = EXCLUDED.base_defense,
         base_speed = EXCLUDED.base_speed,
         gmo_cost = EXCLUDED.gmo_cost`,
      [
        robot.slug,
        robot.display_name,
        robot.element,
        robot.tier,
        `robots/${robot.element.toLowerCase()}/${robot.slug}.json`,
        robot.base_hp,
        robot.base_attack,
        robot.base_defense,
        robot.base_speed,
        robot.base_energy,
        robot.energy_regen,
        robot.strong_vs,
        robot.weak_vs,
        JSON.stringify(robot.biome_bonus),
        robot.gmo_cost,
        robot.is_starter,
      ]
    );
  }

  logger.info(`✅ Seeded ${ROBOT_SEEDS.length} robots`);
  process.exit(0);
}

seed().catch((err) => {
  logger.error("Seed failed:", err);
  process.exit(1);
});
