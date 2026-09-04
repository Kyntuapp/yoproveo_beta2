if (typeof window !== 'undefined') {
  throw new Error('lib/nicanor/mcp es exclusivo del servidor');
}

export {
  createNicanorMcpServer,
  NICANOR_MCP_NAME,
  NICANOR_MCP_VERSION,
  NICANOR_MCP_INSTRUCTIONS,
} from './server.js';
export { handleNicanorMcpHttp } from './http.js';
export { verifyNicanorMcpToken } from './auth.js';
