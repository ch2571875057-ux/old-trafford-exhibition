#!/usr/bin/env node
/**
 * tools/serve.mjs · 零依赖本地静态服务（断网回退用）
 * ---------------------------------------------------------------------------
 * 启动.bat 在没有 Python 时的第二选择：只用 Node 内置模块，不装任何包、
 * 不访问网络，弥补 `npx serve` 需要联网下载的问题。
 *
 *   node tools/serve.mjs [端口]        # 默认 8080，服务脚本上级目录（仓库根）
 * ---------------------------------------------------------------------------
 */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number.parseInt(process.argv[2] || '8080', 10);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const safe = path.normalize(urlPath).replace(/^([/\\])+/, '');   // 去首斜杠并防目录穿越
    let filePath = path.join(ROOT, safe);
    if (!filePath.startsWith(ROOT)) throw Object.assign(new Error('forbidden'), { code: 'EACCES' });
    if (urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html');
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat?.isDirectory()) filePath = path.join(filePath, 'index.html');

    const data = await fs.readFile(filePath);                          // 无 index.html → 404
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch (error) {
    const status = error.code === 'EACCES' ? 403 : 404;
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`${status}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[serve] http://127.0.0.1:${PORT}/  (root: ${ROOT})`);
});
