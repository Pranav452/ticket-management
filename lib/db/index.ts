/**
 * MSSQL connection pools
 * Two pools:
 *   - linksPool  → LinksDB20  (freight-forwarding / Bajaj work orders)
 *   - manilalPool → manilal   (main ERP / tickets)
 *
 * Pools are lazily initialised once and reused across all API routes.
 */

import sql from "mssql";

const linksConfig: sql.config = {
  server: process.env.MSSQL_LINKS_HOST!,
  port: parseInt(process.env.MSSQL_LINKS_PORT ?? "1433", 10),
  user: process.env.MSSQL_LINKS_USER!,
  password: process.env.MSSQL_LINKS_PASSWORD!,
  database: process.env.MSSQL_LINKS_DATABASE!,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    min: 1,
    max: 10,
    idleTimeoutMillis: 30_000,
  },
};

const manilalConfig: sql.config = {
  server: process.env.MSSQL_MANILAL_HOST!,
  port: parseInt(process.env.MSSQL_MANILAL_PORT ?? "1433", 10),
  user: process.env.MSSQL_MANILAL_USER!,
  password: process.env.MSSQL_MANILAL_PASSWORD!,
  database: process.env.MSSQL_MANILAL_DATABASE!,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    min: 1,
    max: 10,
    idleTimeoutMillis: 30_000,
  },
};

// Module-level singletons (survive hot-reload in dev via global cache)
declare global {
  // eslint-disable-next-line no-var
  var __linksPool: sql.ConnectionPool | undefined;
  // eslint-disable-next-line no-var
  var __manilalPool: sql.ConnectionPool | undefined;
}

async function getLinksPool(): Promise<sql.ConnectionPool> {
  if (!global.__linksPool || !global.__linksPool.connected) {
    global.__linksPool = await new sql.ConnectionPool(linksConfig).connect();
  }
  return global.__linksPool;
}

async function getManilalPool(): Promise<sql.ConnectionPool> {
  if (!global.__manilalPool || !global.__manilalPool.connected) {
    global.__manilalPool = await new sql.ConnectionPool(manilalConfig).connect();
  }
  return global.__manilalPool;
}

export { getLinksPool, getManilalPool, sql };
