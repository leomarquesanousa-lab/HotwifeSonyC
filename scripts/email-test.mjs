import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

async function run() {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(directory, "..");
  process.chdir(root);
  const result = await build({
    entryPoints: [path.join(directory, "email-test.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    write: false,
    logLevel: "silent",
  });
  const filename = path.join(directory, "email-test.memory.cjs");
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(result.outputFiles[0].text, filename);
  await loaded.exports.main(process.argv.slice(2));
}
run().catch(() => {
  console.log(
    "Configuration: FAILED\nAuthentication: NOT CHECKED\nProvider accepted message: NO (not sent)\nMessage ID: n/a",
  );
  process.exitCode = 1;
});
