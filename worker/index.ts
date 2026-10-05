import { runDueManyVidsPublications } from "../src/lib/distribution/manyvids-scheduling";
import {
  withEmailEnvironment,
  type EmailEnvironment,
} from "../src/lib/email/config";
import { withAuthRequestIp } from "../src/lib/auth/rate-limit";
import handler from "vinext/server/fetch-handler";

import { createDatabase, runWithRequestDatabase } from "../src/prisma/db";

type VinextEnv = NonNullable<Parameters<typeof handler.fetch>[1]> & {
  DATABASE_URL?: string;
} & EmailEnvironment;

type VinextExecutionContext = NonNullable<Parameters<typeof handler.fetch>[2]>;

const worker = {
  async scheduled(_controller: unknown, env: VinextEnv) {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL_MISSING");
    const database = createDatabase(env.DATABASE_URL);
    try {
      await runWithRequestDatabase(database, () =>
        runDueManyVidsPublications(),
      );
    } finally {
      await database.close();
    }
  },
  async fetch(
    request: Request,
    env: VinextEnv,
    ctx: VinextExecutionContext,
  ): Promise<Response> {
    const databaseUrl = env.DATABASE_URL?.trim();

    if (!databaseUrl) {
      return Response.json(
        {
          success: false,
          error: "DATABASE_URL_MISSING",
        },
        {
          status: 500,
        },
      );
    }

    const database = createDatabase(databaseUrl);

    try {
      const response = await runWithRequestDatabase<Response>(
        database,
        async () =>
          withEmailEnvironment(env, () =>
            withAuthRequestIp(
              request.headers.get("cf-connecting-ip"),
              async () => (await handler.fetch(request, env, ctx)) as Response,
            ),
          ),
      );

      /*
       * Prisma's Cloudflare guidance is to create one client per
       * request and release its pool after the request. waitUntil()
       * lets the response return without holding the request open
       * while the pool is being closed.
       */
      ctx.waitUntil(database.close());

      return response;
    } catch (error) {
      try {
        await database.close();
      } catch {
        console.error("DATABASE_CLOSE_FAILED");
      }

      throw error;
    }
  },
};

export default worker;
