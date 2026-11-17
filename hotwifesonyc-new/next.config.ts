import type { NextConfig } from 'next';
const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  ...(process.env.SONY_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
  outputFileTracingExcludes: { '/*': ['./.local/**/*', './test-results/**/*', './reference/**/*', './docs/**/*'] },
  experimental: process.env.SONY_STANDALONE === '1'
    ? { cpus: 1, workerThreads: false, webpackBuildWorker: false }
    : { cpus: 2 },
};
export default config;
