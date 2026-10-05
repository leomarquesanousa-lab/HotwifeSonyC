import "dotenv/config";

import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "@prisma/orm-postgres/runtime";

import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

type DatabaseClient =
  ReturnType<
    typeof postgres<Contract>
  >;

const requestDatabase =
  new AsyncLocalStorage<DatabaseClient>();

let nodeDatabase:
  DatabaseClient | null = null;

export function createDatabase(
  url: string,
): DatabaseClient {
  const normalizedUrl =
    url?.trim();

  if (!normalizedUrl) {
    throw new Error(
      "DATABASE_URL_MISSING",
    );
  }

  return postgres<Contract>({
    contractJson,
    url: normalizedUrl,
  });
}

export async function runWithRequestDatabase<T>(
  database: DatabaseClient,
  callback: () => Promise<T>,
): Promise<T> {
  return requestDatabase.run(
    database,
    callback,
  );
}

function getActiveDatabase():
  DatabaseClient {
  const scopedDatabase =
    requestDatabase.getStore();

  if (scopedDatabase) {
    return scopedDatabase;
  }

  /*
   * Traditional Node.js servers (next dev and next start) do not
   * pass through worker/index.ts. Reuse a process-local client there.
   *
   * Cloudflare requests must always have a request-scoped
   * database supplied by worker/index.ts. Falling back to a global
   * client would recreate the Worker socket-reuse problem
   * this module is designed to prevent.
   */
  if (
    !("WebSocketPair" in globalThis)
  ) {
    if (!nodeDatabase) {
      nodeDatabase =
        createDatabase(
          process.env
            .DATABASE_URL ??
            "",
        );
    }

    return nodeDatabase;
  }

  throw new Error(
    "DATABASE_REQUEST_CONTEXT_MISSING",
  );
}

export const db =
  new Proxy(
    {} as DatabaseClient,
    {
      get(
        _target,
        property,
      ) {
        const database =
          getActiveDatabase();

        const value =
          Reflect.get(
            database as object,
            property,
            database,
          );

        if (
          typeof value ===
          "function"
        ) {
          return value.bind(
            database,
          );
        }

        return value;
      },
    },
  );
