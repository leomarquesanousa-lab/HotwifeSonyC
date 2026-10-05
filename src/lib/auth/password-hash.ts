import {
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  argon2idAsync,
} from "@noble/hashes/argon2.js";

const ARGON2_MEMORY_COST = 65536;
const ARGON2_TIME_COST = 3;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;
const ARGON2_VERSION = 0x13;
const ARGON2_SALT_LENGTH = 16;

function encodeBase64(
  value: Uint8Array,
) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=+$/g, "");
}

function decodeBase64(
  value: string,
) {
  return Buffer.from(
    value,
    "base64",
  );
}

export async function hashPassword(
  password: string,
) {
  const salt =
    randomBytes(
      ARGON2_SALT_LENGTH,
    );

  const hash =
    await argon2idAsync(
      password,
      salt,
      {
        m:
          ARGON2_MEMORY_COST,

        t:
          ARGON2_TIME_COST,

        p:
          ARGON2_PARALLELISM,

        dkLen:
          ARGON2_HASH_LENGTH,

        version:
          ARGON2_VERSION,
      },
    );

  return [
    "",
    "argon2id",
    "v=19",
    `m=${ARGON2_MEMORY_COST},t=${ARGON2_TIME_COST},p=${ARGON2_PARALLELISM}`,
    encodeBase64(
      salt,
    ),
    encodeBase64(
      hash,
    ),
  ].join("$");
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
) {
  try {
    const parts =
      passwordHash.split(
        "$",
      );

    if (
      parts.length !== 6 ||
      parts[1] !==
        "argon2id"
    ) {
      return false;
    }

    const versionPart =
      parts[2];

    const parametersPart =
      parts[3];

    const saltPart =
      parts[4];

    const hashPart =
      parts[5];

    if (
      !versionPart ||
      !parametersPart ||
      !saltPart ||
      !hashPart
    ) {
      return false;
    }

    const versionMatch =
      /^v=(\d+)$/.exec(
        versionPart,
      );

    if (!versionMatch) {
      return false;
    }

    const version =
      Number(
        versionMatch[1],
      );

    const parameters =
      Object.fromEntries(
        parametersPart
          .split(",")
          .map(
            (item) => {
              const [
                key,
                value,
              ] =
                item.split(
                  "=",
                );

              return [
                key,
                Number(
                  value,
                ),
              ];
            },
          ),
      );

    const memoryCost =
      parameters.m;

    const timeCost =
      parameters.t;

    const parallelism =
      parameters.p;

    if (
      !Number.isInteger(
        memoryCost,
      ) ||
      !Number.isInteger(
        timeCost,
      ) ||
      !Number.isInteger(
        parallelism,
      )
    ) {
      return false;
    }

    const salt =
      decodeBase64(
        saltPart,
      );

    const expectedHash =
      decodeBase64(
        hashPart,
      );

    const actualHash =
      await argon2idAsync(
        password,
        salt,
        {
          m:
            memoryCost,

          t:
            timeCost,

          p:
            parallelism,

          dkLen:
            expectedHash.length,

          version,
        },
      );

    if (
      expectedHash.length !==
      actualHash.length
    ) {
      return false;
    }

    return timingSafeEqual(
      expectedHash,
      Buffer.from(
        actualHash,
      ),
    );
  } catch {
    return false;
  }
}