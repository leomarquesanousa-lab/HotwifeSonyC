import {
  mkdir,
} from "fs/promises";

import path from "path";

import {
  chromium,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright";

const MANYVIDS_HOME_URL =
  "https://www.manyvids.com/";

const MANYVIDS_UPLOAD_URL =
  "https://www.manyvids.com/upload-video";

const MANYVIDS_RUNTIME_DIR =
  path.join(
    process.cwd(),
    ".runtime",
    "manyvids",
  );

const MANYVIDS_HEADLESS =
  process.platform !== "win32";

type ManyVidsBrowserSession = {
  context: BrowserContext;
  page: Page;
  profilePath: string;
};

export type ManyVidsLoginStatus = {
  connected: boolean;
  reason:
    | "connected"
    | "login_required"
    | "profile_in_use"
    | "not_manyvids"
    | "unknown";
  currentUrl: string | null;
};

export type ManyVidsUploadDiscovery = {
  found: boolean;
  currentUrl: string;
  matchedBy: string | null;
};

const activeSessions =
  new Map<
    string,
    ManyVidsBrowserSession
  >();

function sanitizeCreatorId(
  creatorId: string,
) {
  return creatorId.replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
}

function getCreatorProfilePath(
  creatorId: string,
) {
  return path.join(
    MANYVIDS_RUNTIME_DIR,
    sanitizeCreatorId(
      creatorId,
    ),
  );
}

async function ensureRuntimeDirectory() {
  await mkdir(
    MANYVIDS_RUNTIME_DIR,
    {
      recursive: true,
    },
  );
}

async function ensureCreatorProfile(
  creatorId: string,
) {
  await ensureRuntimeDirectory();

  const profilePath =
    getCreatorProfilePath(
      creatorId,
    );

  await mkdir(
    profilePath,
    {
      recursive: true,
    },
  );

  return profilePath;
}

async function locatorIsVisible(
  locator: Locator,
) {
  try {
    return await locator
      .first()
      .isVisible();
  } catch {
    return false;
  }
}

function isProfileInUseError(
  error: unknown,
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const normalized =
    message.toLowerCase();

  return (
    normalized.includes(
      "processsingleton",
    ) ||
    normalized.includes(
      "singletonlock",
    ) ||
    normalized.includes(
      "profile appears to be in use",
    ) ||
    normalized.includes(
      "user data directory is already in use",
    )
  );
}

async function getPrimaryPage(
  context: BrowserContext,
) {
  let page =
    context.pages()[0];

  if (!page) {
    page =
      await context.newPage();
  }

  return page;
}

function isManyVidsUrl(
  value: string,
) {
  try {
    const parsed =
      new URL(value);

    const hostname =
      parsed.hostname
        .toLowerCase();

    return (
      hostname ===
        "manyvids.com" ||
      hostname.endsWith(
        ".manyvids.com",
      )
    );
  } catch {
    return false;
  }
}

async function inspectLoginState(
  page: Page,
): Promise<ManyVidsLoginStatus> {
  const currentUrl =
    page.url();

  if (
    !isManyVidsUrl(
      currentUrl,
    )
  ) {
    return {
      connected: false,
      reason:
        "not_manyvids",
      currentUrl,
    };
  }

  let pathname = "";

  try {
    pathname =
      new URL(
        currentUrl,
      ).pathname.toLowerCase();
  } catch {
    pathname = "";
  }

  const loginUrl =
    pathname.includes(
      "login",
    ) ||
    pathname.includes(
      "signin",
    ) ||
    pathname.includes(
      "sign-in",
    );

  const passwordVisible =
    await locatorIsVisible(
      page.locator(
        'input[type="password"]',
      ),
    );

  const signInLinkVisible =
    await locatorIsVisible(
      page.getByRole(
        "link",
        {
          name:
            /sign in|log in|login/i,
        },
      ),
    );

  const signInButtonVisible =
    await locatorIsVisible(
      page.getByRole(
        "button",
        {
          name:
            /sign in|log in|login/i,
        },
      ),
    );

  if (
    loginUrl ||
    passwordVisible ||
    signInLinkVisible ||
    signInButtonVisible
  ) {
    return {
      connected: false,
      reason:
        "login_required",
      currentUrl,
    };
  }

  return {
    connected: true,
    reason:
      "connected",
    currentUrl,
  };
}

export function hasActiveManyVidsSession(
  creatorId: string,
) {
  const session =
    activeSessions.get(
      creatorId,
    );

  return Boolean(
    session &&
      !session.page.isClosed(),
  );
}

export function getActiveManyVidsSession(
  creatorId: string,
) {
  return (
    activeSessions.get(
      creatorId,
    ) ?? null
  );
}

export async function openManyVidsBrowser(
  creatorId: string,
): Promise<ManyVidsBrowserSession> {
  const existingSession =
    activeSessions.get(
      creatorId,
    );

  if (existingSession) {
    try {
      if (
        !existingSession.page.isClosed()
      ) {
        await existingSession.page
          .bringToFront();

        return existingSession;
      }
    } catch {
      activeSessions.delete(
        creatorId,
      );
    }
  }

  const profilePath =
    await ensureCreatorProfile(
      creatorId,
    );

  const context =
    await chromium.launchPersistentContext(
      profilePath,
      {
        headless: MANYVIDS_HEADLESS,
        viewport: null,
        acceptDownloads: true,
      },
    );

  const page =
    await getPrimaryPage(
      context,
    );

  const session: ManyVidsBrowserSession =
    {
      context,
      page,
      profilePath,
    };

  activeSessions.set(
    creatorId,
    session,
  );

  context.on(
    "close",
    () => {
      activeSessions.delete(
        creatorId,
      );
    },
  );

  await page.goto(
    MANYVIDS_HOME_URL,
    {
      waitUntil:
        "domcontentloaded",
      timeout: 60_000,
    },
  );

  await page.bringToFront();

  return session;
}

export async function verifyManyVidsSession(
  creatorId: string,
): Promise<ManyVidsLoginStatus> {
  const activeSession =
    activeSessions.get(
      creatorId,
    );

  if (
    activeSession &&
    !activeSession.page.isClosed()
  ) {
    try {
      return await inspectLoginState(
        activeSession.page,
      );
    } catch {
      // Continue with persisted profile verification.
    }
  }

  const profilePath =
    await ensureCreatorProfile(
      creatorId,
    );

  let context:
    | BrowserContext
    | null = null;

  try {
    context =
      await chromium.launchPersistentContext(
        profilePath,
        {
          headless: true,
          viewport: {
            width: 1440,
            height: 1000,
          },
        },
      );

    const page =
      await getPrimaryPage(
        context,
      );

    await page.goto(
      MANYVIDS_HOME_URL,
      {
        waitUntil:
          "domcontentloaded",
        timeout: 60_000,
      },
    );

    await page.waitForTimeout(
      1200,
    );

    return await inspectLoginState(
      page,
    );
  } catch (error) {
    if (
      isProfileInUseError(
        error,
      )
    ) {
      return {
        connected: false,
        reason:
          "profile_in_use",
        currentUrl: null,
      };
    }

    console.error(
      "MANYVIDS_SESSION_VERIFY_ERROR",
      error,
    );

    return {
      connected: false,
      reason:
        "unknown",
      currentUrl: null,
    };
  } finally {
    if (context) {
      try {
        await context.close();
      } catch {
        // Ignore shutdown errors.
      }
    }
  }
}

export async function openManyVidsUploadArea(
  creatorId: string,
): Promise<ManyVidsUploadDiscovery> {
  const existingSession =
    activeSessions.get(
      creatorId,
    );

  let context:
    | BrowserContext
    | null = null;

  let page: Page;

  let ownsContext = false;

  if (
    existingSession &&
    !existingSession.page.isClosed()
  ) {
    page =
      existingSession.page;
  } else {
    const profilePath =
      await ensureCreatorProfile(
        creatorId,
      );

    context =
      await chromium.launchPersistentContext(
        profilePath,
        {
          headless: MANYVIDS_HEADLESS,
          viewport: null,
          acceptDownloads: true,
        },
      );

    page =
      await getPrimaryPage(
        context,
      );

    ownsContext = true;
  }

  try {
    await page.goto(
      MANYVIDS_UPLOAD_URL,
      {
        waitUntil:
          "domcontentloaded",
        timeout: 60_000,
      },
    );

    await page.waitForTimeout(
      1500,
    );

    await page.bringToFront();

    const loginStatus =
      await inspectLoginState(
        page,
      );

    if (
      !loginStatus.connected
    ) {
      return {
        found: false,
        currentUrl:
          page.url(),
        matchedBy:
          "LOGIN_REQUIRED",
      };
    }

    const result =
      await findManyVidsUploadControl(
        page,
      );

    console.log(
      "MANYVIDS_UPLOAD_DISCOVERY",
      {
        creatorId,
        found:
          result.found,
        currentUrl:
          result.currentUrl,
        matchedBy:
          result.matchedBy,
      },
    );

    return result;
  } finally {
    if (
      ownsContext &&
      context
    ) {
      /*
       * Keep this browser open for the current MVP flow.
       * We want to visually inspect the upload page.
       */
    }
  }
}

export async function findManyVidsUploadControl(
  page: Page,
): Promise<ManyVidsUploadDiscovery> {
  const fileInputs =
    page.locator(
      'input[type="file"]',
    );

  try {
    const count =
      await fileInputs.count();

    if (count > 0) {
      return {
        found: true,
        currentUrl:
          page.url(),
        matchedBy:
          "input[type=file]",
      };
    }
  } catch {
    // Continue discovery.
  }

  const possibleControls = [
    {
      name:
        "Select Vids To Upload",
      locator:
        page.getByText(
          /select vids? to upload/i,
          {
            exact: false,
          },
        ),
    },
    {
      name:
        "Select Videos To Upload",
      locator:
        page.getByText(
          /select videos? to upload/i,
          {
            exact: false,
          },
        ),
    },
    {
      name:
        "Choose File",
      locator:
        page.getByText(
          /choose file/i,
          {
            exact: false,
          },
        ),
    },
    {
      name:
        "Upload Video",
      locator:
        page.getByText(
          /upload video/i,
          {
            exact: false,
          },
        ),
    },
  ];

  for (
    const control of possibleControls
  ) {
    if (
      await locatorIsVisible(
        control.locator,
      )
    ) {
      return {
        found: true,
        currentUrl:
          page.url(),
        matchedBy:
          control.name,
      };
    }
  }

  return {
    found: false,
    currentUrl:
      page.url(),
    matchedBy: null,
  };
}

export async function closeManyVidsBrowser(
  creatorId: string,
) {
  const session =
    activeSessions.get(
      creatorId,
    );

  if (!session) {
    return;
  }

  activeSessions.delete(
    creatorId,
  );

  await session.context.close();
}

export async function getManyVidsPage(
  creatorId: string,
) {
  const session =
    activeSessions.get(
      creatorId,
    );

  if (
    !session ||
    session.page.isClosed()
  ) {
    return null;
  }

  return session.page;
}