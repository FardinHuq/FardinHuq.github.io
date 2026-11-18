// Tiny local preview server (no installs needed): node serve.mjs  ->  http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
const ROOT = join(process.cwd(), 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain' };
createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
  let f = join(ROOT, p);
  try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); const b = await readFile(f); res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end(await readFile(join(ROOT, '404.html')).catch(() => 'Not found')); }
}).listen(8080, () => console.log('Preview: http://localhost:8080   (admin: http://localhost:8080/admin/)'));
