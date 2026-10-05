import crypto from "node:crypto";

function getEncryptionKey() {
  const rawKey =
    process.env.PLATFORM_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.FANVUE_TOKEN_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    throw new Error("PLATFORM_TOKEN_ENCRYPTION_KEY_MISSING");
  }

  const key = Buffer.from(rawKey, "hex");

  if (key.length !== 32) {
    throw new Error("PLATFORM_TOKEN_ENCRYPTION_KEY_INVALID");
  }

  return key;
}

export function encryptPlatformToken(value: string) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptPlatformToken(
  encryptedValue: string,
) {
  const parts =
    encryptedValue.split(".");

  if (
    parts.length !== 4 ||
    parts[0] !== "v1"
  ) {
    throw new Error(
      "INVALID_ENCRYPTED_TOKEN_FORMAT",
    );
  }

  const [
    ,
    ivValue,
    authTagValue,
    encryptedValuePart,
  ] = parts;

  const key =
    getEncryptionKey();

  const iv =
    Buffer.from(
      ivValue,
      "base64url",
    );

  const authTag =
    Buffer.from(
      authTagValue,
      "base64url",
    );

  const encrypted =
    Buffer.from(
      encryptedValuePart,
      "base64url",
    );

  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      iv,
    );

  decipher.setAuthTag(
    authTag,
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        encrypted,
      ),
      decipher.final(),
    ]);

  return decrypted.toString(
    "utf8",
  );
}
