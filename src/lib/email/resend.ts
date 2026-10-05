// Compatibility export; configuration is resolved inside the active request, never during module initialization.
import { getEmailClient } from "./client";
import type { Resend } from "resend";
export const resend = new Proxy({} as Resend, {
  get(_target, key) {
    const client = getEmailClient();
    const value = Reflect.get(client, key);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
