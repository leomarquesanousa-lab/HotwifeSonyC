/** Local/admin only. No database access. Sending requires an explicit --to argument. */
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { emailConfiguration } from "../src/lib/email/config";
import { sendEmail } from "../src/lib/email/client";

export async function main(args: string[]) {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  let configuration = "FAILED";
  let authentication = "NOT CHECKED";
  let accepted = "NO (not sent)";
  let messageId = "n/a";
  try {
    if (
      args.length &&
      (args.length !== 2 ||
        args[0] !== "--to" ||
        !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(args[1]))
    )
      throw new Error();
    const config = emailConfiguration();
    configuration = "OK";
    try {
      const response = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      const body: unknown = await response.json().catch(() => null);
      const restricted =
        body !== null &&
        typeof body === "object" &&
        "name" in body &&
        body.name === "restricted_api_key";
      authentication = response.ok
        ? "OK"
        : restricted
          ? "INCONCLUSIVE (sending-only key)"
          : "FAILED";
    } catch {
      authentication = "INCONCLUSIVE (connection unavailable)";
    }
    if (args.length === 2) {
      accepted = "NO";
      const result = await sendEmail(
        {
          to: args[1],
          subject: "Creator Platform email transport test",
          html: "<p>Creator Platform email transport test.</p>",
          text: "Creator Platform email transport test.",
        },
        "auth-test:" + randomUUID(),
      );
      accepted = "YES";
      authentication = "OK";
      if (/^[a-zA-Z0-9-]{1,100}$/.test(result.id)) messageId = result.id;
    }
  } catch {
    process.exitCode = 1;
  }
  console.log(
    `Configuration: ${configuration}\nAuthentication: ${authentication}\nProvider accepted message: ${accepted}\nMessage ID: ${messageId}`,
  );
}
