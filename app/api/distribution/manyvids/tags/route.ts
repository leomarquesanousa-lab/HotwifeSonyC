import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/src/lib/auth/session";
import { db } from "@/src/prisma/db";
import { ManyVidsClient } from "@/src/lib/platforms/manyvids/http/client";
import {
  decryptManyVidsSession,
  encryptManyVidsSession,
} from "@/src/lib/platforms/manyvids/http/session";
import { searchTags } from "@/src/lib/platforms/manyvids/http/metadata";
import {
  ManyVidsError,
  safeError,
} from "@/src/lib/platforms/manyvids/http/types";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const accountId =
      request.nextUrl.searchParams.get("platformAccountId") ?? "";

    const keywords = (
      request.nextUrl.searchParams.get("keywords") ?? ""
    )
      .trim()
      .slice(0, 100);

    if (!accountId || keywords.length < 2) {
      throw new ManyVidsError(
        "ACCOUNT_AND_KEYWORDS_REQUIRED",
        "TAGS",
        400,
      );
    }

    const account = await db.orm.public.PlatformAccount.where({
      id: accountId,
      platform: "MANYVIDS",
      status: "CONNECTED",
    }).first();

    if (!account) {
      throw new ManyVidsError("ACCOUNT_NOT_FOUND", "SESSION", 404);
    }

    const member = await db.orm.public.WorkspaceMember.where({
      userId: session.user.id,
      workspaceId: account.workspaceId,
    }).first();

    if (!member) {
      throw new ManyVidsError("ACCOUNT_NOT_FOUND", "SESSION", 404);
    }

    let expectedEncryptedSession = account.accessTokenEncrypted;

    const client = new ManyVidsClient(
      decryptManyVidsSession(
        account.accessTokenEncrypted,
        account.externalAccountId,
      ),
      async (nextSession) => {
        /*
         * Persist refreshed cookies only if the stored session has not
         * changed since our last successful write (or the initial read).
         *
         * This prevents tag autocomplete from overwriting a newer session
         * saved concurrently by the publishing executor.
         */
        const encrypted = encryptManyVidsSession(nextSession);
        const updated = await db.orm.public.PlatformAccount.where({
          id: account.id,
          workspaceId: account.workspaceId,
          accessTokenEncrypted: expectedEncryptedSession,
        }).updateAndCount({
          accessTokenEncrypted: encrypted,
        });
        if (updated !== 1) {
          throw new ManyVidsError("ACCOUNT_SESSION_CHANGED", "SESSION", 409);
        }
        expectedEncryptedSession = encrypted;
      },
    );

    /*
     * The publishing flow refreshes the ManyVids session before using
     * authenticated API endpoints. Tag search must do the same.
     */
    await client.refresh();

    const tags = await searchTags(client, keywords);

    return NextResponse.json(
      { success: true, tags },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    const safe = safeError(error);

    return NextResponse.json(
      {
        success: false,
        error: safe.code,
        message: safe.message,
      },
      { status: safe.httpStatus },
    );
  }
}
