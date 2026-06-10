import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultBusDataPath = fileURLToPath(new URL("../../data/bus_data.json", import.meta.url));
const defaultAliasesPath = fileURLToPath(
  new URL("../../data/landmark_aliases.json", import.meta.url)
);
const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));

function parseArgs(argv) {
  const args = {
    input: defaultBusDataPath,
    aliases: defaultAliasesPath,
    dryRun: false
  };

  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--input=")) args.input = path.resolve(arg.split("=", 2)[1]);
    else if (arg.startsWith("--aliases=")) args.aliases = path.resolve(arg.split("=", 2)[1]);
  }

  return args;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function normalizeBus(bus) {
  const stops = Array.isArray(bus.stops) ? bus.stops : [];

  return {
    name: cleanText(bus.name),
    nameBn: cleanText(bus.nameBn),
    slug: cleanText(bus.slug),
    sourceUrl: cleanText(bus.sourceUrl),
    description: cleanText(bus.description),
    seatingType: cleanText(bus.seatingType),
    fareRange: cleanText(bus.fareRange),
    operator: cleanText(bus.operator),
    startTime: cleanText(bus.operatingHours?.start),
    endTime: cleanText(bus.operatingHours?.end),
    ticketingSystem: cleanText(bus.ticketingSystem),
    lastUpdated: cleanText(bus.lastUpdated),
    stops: stops
      .map((stop, index) => ({
        order: Number(stop.order || index + 1),
        name: cleanText(stop.name),
        nameBn: cleanText(stop.nameBn),
        raw: cleanText(stop.raw)
      }))
      .filter((stop) => Number.isFinite(stop.order) && stop.order > 0 && stop.name)
      .sort((a, b) => a.order - b.order)
      .map((stop, index) => ({
        ...stop,
        order: index + 1
      })),
    counterStops: (Array.isArray(bus.counterStops) ? bus.counterStops : [])
      .map((stop, index) => ({
        order: Number(stop.order || index + 1),
        name: cleanText(stop.name),
        nameBn: cleanText(stop.nameBn),
        raw: cleanText(stop.raw)
      }))
      .filter((stop) => Number.isFinite(stop.order) && stop.order > 0 && stop.name)
      .sort((a, b) => a.order - b.order)
      .map((stop, index) => ({
        ...stop,
        order: index + 1
      }))
  };
}

function normalizeAlias(alias) {
  return {
    colloquialName: cleanText(alias.colloquialName),
    canonicalName: cleanText(alias.canonicalName),
    zoneId: cleanText(alias.zoneId),
    languageCode: cleanText(alias.languageCode) || "mixed"
  };
}

function validateSeedData(busData, aliases) {
  const buses = (busData.buses || []).map(normalizeBus);
  const normalizedAliases = (aliases || []).map(normalizeAlias);
  const invalidBuses = buses.filter((bus) => !bus.name || !bus.stops.length);
  const invalidAliases = normalizedAliases.filter(
    (alias) => !alias.colloquialName || !alias.canonicalName
  );

  if (invalidBuses.length) {
    throw new Error(`Seed data has ${invalidBuses.length} invalid bus records.`);
  }

  if (invalidAliases.length) {
    throw new Error(`Alias data has ${invalidAliases.length} invalid records.`);
  }

  return {
    buses,
    aliases: normalizedAliases,
    stopCount: buses.reduce((sum, bus) => sum + bus.stops.length, 0)
  };
}

function loadDotEnvFile(filePath) {
  return readFile(filePath, "utf8")
    .then((contents) => {
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const equalsIndex = trimmed.indexOf("=");
        if (equalsIndex === -1) continue;

        const key = trimmed.slice(0, equalsIndex).trim();
        let value = trimmed.slice(equalsIndex + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    })
    .catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
}

async function getPgClient() {
  await loadDotEnvFile(rootEnvPath);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  const pg = await import("pg");
  const Client = pg.Client || pg.default?.Client;

  if (!Client) {
    throw new Error("Could not load pg Client. Run npm install before seeding.");
  }

  return new Client({ connectionString: process.env.DATABASE_URL });
}

async function upsertBus(client, bus) {
  const values = [
    bus.name,
    bus.nameBn,
    bus.slug,
    bus.sourceUrl,
    bus.description,
    bus.seatingType,
    bus.fareRange,
    bus.operator,
    bus.startTime,
    bus.endTime,
    bus.ticketingSystem,
    bus.lastUpdated
  ];

  if (bus.slug) {
    const result = await client.query(
      `
        INSERT INTO buses (
          name, name_bn, slug, source_url, description, seating_type, fare_range,
          operator, start_time, end_time, ticketing_system, last_updated
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (slug) WHERE slug IS NOT NULL
        DO UPDATE SET
          name = EXCLUDED.name,
          name_bn = EXCLUDED.name_bn,
          source_url = EXCLUDED.source_url,
          description = EXCLUDED.description,
          seating_type = EXCLUDED.seating_type,
          fare_range = EXCLUDED.fare_range,
          operator = EXCLUDED.operator,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          ticketing_system = EXCLUDED.ticketing_system,
          last_updated = EXCLUDED.last_updated,
          updated_at = NOW()
        RETURNING id
      `,
      values
    );

    return result.rows[0].id;
  }

  if (bus.sourceUrl) {
    const result = await client.query(
      `
        INSERT INTO buses (
          name, name_bn, slug, source_url, description, seating_type, fare_range,
          operator, start_time, end_time, ticketing_system, last_updated
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (source_url) WHERE source_url IS NOT NULL
        DO UPDATE SET
          name = EXCLUDED.name,
          name_bn = EXCLUDED.name_bn,
          slug = EXCLUDED.slug,
          description = EXCLUDED.description,
          seating_type = EXCLUDED.seating_type,
          fare_range = EXCLUDED.fare_range,
          operator = EXCLUDED.operator,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          ticketing_system = EXCLUDED.ticketing_system,
          last_updated = EXCLUDED.last_updated,
          updated_at = NOW()
        RETURNING id
      `,
      values
    );

    return result.rows[0].id;
  }

  const existing = await client.query("SELECT id FROM buses WHERE lower(name) = lower($1)", [
    bus.name
  ]);

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE buses
        SET
          name_bn = $2,
          description = $3,
          seating_type = $4,
          fare_range = $5,
          operator = $6,
          start_time = $7,
          end_time = $8,
          ticketing_system = $9,
          last_updated = $10,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        existing.rows[0].id,
        bus.nameBn,
        bus.description,
        bus.seatingType,
        bus.fareRange,
        bus.operator,
        bus.startTime,
        bus.endTime,
        bus.ticketingSystem,
        bus.lastUpdated
      ]
    );
    return existing.rows[0].id;
  }

  const result = await client.query(
    `
      INSERT INTO buses (
        name, name_bn, description, seating_type, fare_range, operator,
        start_time, end_time, ticketing_system, last_updated
      )
      VALUES ($1, $2, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `,
    values
  );

  return result.rows[0].id;
}

async function replaceStops(client, busId, stops) {
  await client.query("DELETE FROM bus_stops WHERE bus_id = $1", [busId]);

  for (const stop of stops) {
    await client.query(
      `
        INSERT INTO bus_stops (bus_id, stop_name, stop_name_bn, raw_name, stop_order)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [busId, stop.name, stop.nameBn, stop.raw, stop.order]
    );
  }
}

async function replaceCounterStops(client, busId, counterStops) {
  await client.query("DELETE FROM bus_counters WHERE bus_id = $1", [busId]);

  for (const stop of counterStops) {
    await client.query(
      `
        INSERT INTO bus_counters (bus_id, counter_name, counter_name_bn, raw_name, counter_order)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [busId, stop.name, stop.nameBn, stop.raw, stop.order]
    );
  }
}

async function upsertAlias(client, alias) {
  const existing = await client.query(
    `
      SELECT id
      FROM landmarks
      WHERE lower(colloquial_name) = lower($1)
        AND lower(canonical_name) = lower($2)
      LIMIT 1
    `,
    [alias.colloquialName, alias.canonicalName]
  );

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE landmarks
        SET
          zone_id = $2,
          language_code = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [existing.rows[0].id, alias.zoneId, alias.languageCode]
    );
    return;
  }

  await client.query(
    `
      INSERT INTO landmarks (colloquial_name, canonical_name, zone_id, language_code)
      VALUES ($1, $2, $3, $4)
    `,
    [alias.colloquialName, alias.canonicalName, alias.zoneId, alias.languageCode]
  );
}

async function seedDatabase({ buses, aliases }) {
  const client = await getPgClient();
  let insertedStops = 0;
  let insertedCounterStops = 0;

  await client.connect();

  try {
    await client.query("BEGIN");

    for (const bus of buses) {
      const busId = await upsertBus(client, bus);
      await replaceStops(client, busId, bus.stops);
      await replaceCounterStops(client, busId, bus.counterStops);
      insertedStops += bus.stops.length;
      insertedCounterStops += bus.counterStops.length;
    }

    for (const alias of aliases) {
      await upsertAlias(client, alias);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  return {
    buses: buses.length,
    stops: insertedStops,
    counterStops: insertedCounterStops,
    aliases: aliases.length
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const busData = await readJson(args.input);
  const aliases = await readJson(args.aliases);
  const seedData = validateSeedData(busData, aliases);

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          buses: seedData.buses.length,
          stops: seedData.stopCount,
          aliases: seedData.aliases.length,
          counterStops: seedData.buses.reduce(
            (sum, bus) => sum + bus.counterStops.length,
            0
          ),
          firstBus: {
            name: seedData.buses[0]?.name,
            stops: seedData.buses[0]?.stops.length,
            counterStops: seedData.buses[0]?.counterStops.length
          }
        },
        null,
        2
      )
    );
    return;
  }

  const result = await seedDatabase(seedData);
  console.log(
    `Seeded ${result.buses} buses, ${result.stops} ordered stops, ${result.counterStops} counter stops, and ${result.aliases} aliases.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
