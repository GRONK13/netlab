// pm2 process file for the school server: `pm2 start ecosystem.config.cjs`
module.exports = {
  apps: [
    {
      name: 'netlab',
      cwd: __dirname,
      script: 'apps/server/src/index.ts',
      // Node 24 runs TypeScript directly; stop pm2 from looking for ts-node.
      interpreter: 'node',
      node_args: '--env-file-if-exists=.env',
      max_memory_restart: '400M',
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
