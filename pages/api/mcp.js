import { handleNicanorMcpHttp } from '../../lib/nicanor/mcp/http.js';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

export default async function handler(req, res) {
  await handleNicanorMcpHttp(req, res);
}
