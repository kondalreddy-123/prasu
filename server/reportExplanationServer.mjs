import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReportExplanationService } from './reportExplanationService.mjs';

const PORT = Number(process.env.REPORT_AI_PORT || 3031);
const MAX_BODY_BYTES = 35000;
const sessionToken = randomBytes(32).toString('hex');
const explainReport = createReportExplanationService();

function isLoopback(address = '') {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function allowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname) && Number(url.port || 80) >= 3000 && Number(url.port || 80) <= 3010;
  } catch { return false; }
}

function safeTokenMatch(received = '') {
  const a = Buffer.from(String(received));
  const b = Buffer.from(sessionToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

export const server = createServer(async (req, res) => {
  if (!isLoopback(req.socket.remoteAddress) || !allowedOrigin(req.headers.origin)) return send(res, 403, { error: 'Local demo requests only.' });
  if (req.method === 'GET' && req.url === '/api/report-explanations/session') {
    return send(res, 200, { token: sessionToken, configured: Boolean(process.env.OPENAI_API_KEY) });
  }
  if (req.method !== 'POST' || req.url !== '/api/report-explanations') return send(res, 404, { error: 'Not found.' });
  if (!safeTokenMatch(req.headers['x-healthpass-ai-session'])) return send(res, 403, { error: 'Refresh the local demo and try again.' });
  if (!String(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, { error: 'JSON is required.' });
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) { res.destroy(); return; }
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, { error: 'Invalid request.' }); }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const result = await explainReport(body, controller.signal);
    return send(res, result.status, result.data);
  } catch {
    return send(res, 500, { code: 'AI_REQUEST_FAILED', error: 'The explanation could not be generated. Your original report is unchanged.' });
  } finally { clearTimeout(timeout); }
});

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  server.listen(PORT, '127.0.0.1', () => console.log(`HealthPass local AI service listening on 127.0.0.1:${PORT} (key configured: ${Boolean(process.env.OPENAI_API_KEY)})`));
}
