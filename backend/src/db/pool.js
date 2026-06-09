import pg from "pg";

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database queries.");
  }

  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  return pool;
}

function createDefaultRouteRepository() {
  const dbPool = getPool();

  return {
    async findBusRoutes({ origin, destination, maxResults }) {
      const { createRouteRepository } = await import("./routeRepository.js");
      const repository = createRouteRepository({
        query: (sql, params) => dbPool.query(sql, params)
      });

      return repository.findBusRoutes({ origin, destination, maxResults });
    }
  };
}

export { createDefaultRouteRepository, getPool };
