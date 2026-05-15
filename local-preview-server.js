const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = 5002;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getFilePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0] || '/');
  const trimmed = cleanPath.replace(/^\/+/, '');
  const normalized = trimmed ? path.normalize(trimmed) : 'index.html';
  const safePath = normalized.startsWith('..') ? 'index.html' : normalized;

  if (!path.extname(safePath)) {
    return path.join(rootDir, `${safePath}.html`);
  }

  return path.join(rootDir, safePath);
}

const server = http.createServer((request, response) => {
  const filePath = getFilePath(request.url || '/');

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local preview running at http://127.0.0.1:${port}`);
});
