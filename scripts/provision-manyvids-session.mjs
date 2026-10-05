// Local/admin entry point. Compile TypeScript in memory: no generated files or credentials on disk.
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";

process.env.DEBUG = "";
process.env.NODE_DEBUG = "";
process.env.PWDEBUG = "";

async function run() {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(directory, "..");
  process.chdir(root);
  const { build } = await import("esbuild");
  const result = await build({
    entryPoints: [path.join(directory, "provision-manyvids-session.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    write: false,
    logLevel: "silent",
  });
  const filename = path.join(directory, "provision-manyvids-session.memory.cjs");
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(result.outputFiles[0].text, filename);
  await loaded.exports.main(process.argv.slice(2));
}

run().catch(() => {
  // Never print compiler, browser or database error objects: they may contain secrets.
  console.error("Não foi possível iniciar a ferramenta local. Verifique as dependências e a versão do Node (24 ou superior).");
  process.exitCode = 1;
});
