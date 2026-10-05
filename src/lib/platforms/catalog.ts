export type PlatformCode =
  | "FANVUE"
  | "ONLYFANS"
  | "FANSLY"
  | "MYM"
  | "LOYALFANS"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "MANYVIDS"
  | "X"
  | "REDDIT";

export type PlatformConnectionMethod =
  | "OAUTH"
  | "API_KEY"
  | "MANAGED_BROWSER"
  | "PENDING";

export type PlatformAvailability =
  | "AVAILABLE"
  | "INTEGRATION_PENDING";

export type PlatformCatalogItem = {
  code: PlatformCode;
  name: string;
  description: string;
  connectionMethod: PlatformConnectionMethod;
  availability: PlatformAvailability;
  officialApi: boolean;
  colorHint: string;
};

export const PLATFORM_CATALOG: PlatformCatalogItem[] = [
  {
    code: "FANVUE",
    name: "Fanvue",
    description:
      "Connect your Fanvue creator account and authorize publishing access.",
    connectionMethod: "OAUTH",
    availability: "AVAILABLE",
    officialApi: true,
    colorHint: "violet",
  },

  {
    code: "ONLYFANS",
    name: "OnlyFans",
    description:
      "Manage and distribute creator content from one central workspace.",
    connectionMethod: "PENDING",
    availability: "INTEGRATION_PENDING",
    officialApi: false,
    colorHint: "cyan",
  },

  {
    code: "FANSLY",
    name: "Fansly",
    description:
      "Centralize creator publishing and content distribution workflows.",
    connectionMethod: "PENDING",
    availability: "INTEGRATION_PENDING",
    officialApi: false,
    colorHint: "blue",
  },

  {
    code: "MYM",
    name: "MYM",
    description:
      "Prepare creator content for streamlined publishing and management.",
    connectionMethod: "PENDING",
    availability: "INTEGRATION_PENDING",
    officialApi: false,
    colorHint: "purple",
  },

  {
    code: "LOYALFANS",
    name: "LoyalFans",
    description:
      "Extend your distribution workflow to another creator platform.",
    connectionMethod: "PENDING",
    availability: "INTEGRATION_PENDING",
    officialApi: false,
    colorHint: "rose",
  },

  {
    code: "INSTAGRAM",
    name: "Instagram",
    description:
      "Connect a professional Instagram account using the official Instagram Business Login.",
    connectionMethod: "OAUTH",
    availability: "AVAILABLE",
    officialApi: true,
    colorHint: "pink",
  },

  {
    code: "FACEBOOK",
    name: "Facebook",
    description:
      "Connect Facebook Pages for centralized publishing and management.",
    connectionMethod: "OAUTH",
    availability: "AVAILABLE",
    officialApi: true,
    colorHint: "blue",
  },

  {
    code: "MANYVIDS",
    name: "ManyVids",
    description:
      "Connect a ManyVids creator account through a managed browser session for centralized publishing.",
    connectionMethod: "MANAGED_BROWSER",
    availability: "AVAILABLE",
    officialApi: false,
    colorHint: "pink",
  },

  {
    code: "X",
    name: "X",
    description:
      "Connect an X account for publishing and content distribution.",
    connectionMethod: "OAUTH",
    availability: "INTEGRATION_PENDING",
    officialApi: true,
    colorHint: "slate",
  },

  {
    code: "REDDIT",
    name: "Reddit",
    description:
      "Connect Reddit for publishing into authorized communities.",
    connectionMethod: "OAUTH",
    availability: "INTEGRATION_PENDING",
    officialApi: true,
    colorHint: "orange",
  },
];

export function getPlatformDefinition(
  code: string,
) {
  return PLATFORM_CATALOG.find(
    (platform) =>
      platform.code === code,
  );
}

export function getPlatformCatalogItem(
  code: PlatformCode,
) {
  return PLATFORM_CATALOG.find(
    (platform) =>
      platform.code === code,
  );
}