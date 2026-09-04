module.exports = {
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
};
