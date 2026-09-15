const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

module.exports = (phase) => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER
    ? process.env.KYNTU_DEV_DIST_DIR || '.next-dev/3000'
    : '.next',
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/mcp', destination: '/api/mcp' }];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const previous = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      config.externals = [
        ...previous,
        'xlsx',
        ({ request }, callback) => {
          if (
            request &&
            (request.startsWith('@modelcontextprotocol/sdk') ||
              request.startsWith('@hono/node-server') ||
              request === 'hono' ||
              request.startsWith('hono/'))
          ) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
});
