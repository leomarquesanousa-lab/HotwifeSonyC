// In-memory no-op handler test. Never invokes a scheduler or distribution service.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import fs from 'node:fs';
import ts from 'typescript';
const config = ts.parseConfigFileTextToJson('wrangler.jsonc', fs.readFileSync('wrangler.jsonc', 'utf8')).config;
assert.deepEqual(config.triggers.crons, []);
const bundle = await build({ entryPoints: ['worker/index.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'no-live-services', setup(b) {
  b.onResolve({ filter: /distribution\/|dotenv/ }, () => { throw Error('Distribution or production environment must not load in scheduled handler'); });
  b.onResolve({ filter: /prisma\/db$|^vinext\/server\/fetch-handler$|email\/config$|auth\/rate-limit$/ }, a => ({ path: a.path, namespace: 'mock' }));
  b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `export function createDatabase(){throw Error('Database must not open');}export function runWithRequestDatabase(){throw Error('No database');}export function withEmailEnvironment(){throw Error('No email');}export function withAuthRequestIp(){throw Error('No request');}export default {fetch(){throw Error('No remote calls');}};`, loader: 'js' }));
} }] });
const mod = new Module(process.cwd() + '/scripts/release.memory.cjs'); mod.filename = mod.id; mod.paths = Module._nodeModulePaths(process.cwd()); mod._compile(bundle.outputFiles[0].text, mod.filename);
await mod.exports.default.scheduled();
assert(!fs.readFileSync('worker/index.ts', 'utf8').includes('runDueManyVidsPublications'));
console.log('PASS: empty cron config and disabled scheduled handler; no database, distribution, network or real scheduler used.');
