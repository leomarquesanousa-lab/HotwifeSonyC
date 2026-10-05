import { getRequestConfig } from "next-intl/server";

import {
  mediaLibraryMessages,
} from "./messages/modules/mediaLibrary";

import {
  peopleMessages,
} from "./messages/modules/people";

import {
  distributionMessages,
} from "./messages/modules/distribution";

export const locales = [
  "en-US",
  "pt-BR",
  "es-ES",
  "fr-FR",
  "cs-CZ",
] as const;

export type Locale =
  (typeof locales)[number];

export default getRequestConfig(
  async () => {
    const locale = "en-US";

    const baseMessages = (
      await import(
        `./messages/${locale}.json`
      )
    ).default;

    return {
      locale,
      messages: {
        ...baseMessages,

        mediaLibrary:
          mediaLibraryMessages[
            locale as Locale
          ],

        people:
          peopleMessages[
            locale as Locale
          ],

        distribution:
          distributionMessages[
            locale as Locale
          ],
      },
    };
  },
);