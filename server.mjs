import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const address = `http://127.0.0.1:${port}`;
const openRequested = process.argv.includes('--open');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function openBrowser() {
  if (process.platform !== 'win32') return;
  const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', address], { detached: true, stdio: 'ignore', windowsHide: true });
  browser.on('error', () => console.log(`请手动在浏览器打开 ${address}`));
  browser.unref();
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep) && filename !== path.join(root, 'index.html')) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Blue-Hour': 'prototype' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const existing = await fetch(address, { signal: AbortSignal.timeout(2000) });
      if (existing.headers.get('x-blue-hour') === 'prototype') {
        console.log(`蓝调补给站已经在运行：${address}`);
        if (openRequested) openBrowser();
        return;
      }
    } catch { /* 端口可能由其他应用占用，下面给出明确说明。 */ }
    console.error(`端口 ${port} 被其他程序占用。请设置其他 PORT，或关闭占用程序后重试。`);
  } else {
    console.error(`启动失败：${error.message}`);
  }
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`蓝调补给站已启动：${address}`);
  console.log('请保持此窗口开启；按 Ctrl+C 停止服务。');
  if (openRequested) openBrowser();
});
