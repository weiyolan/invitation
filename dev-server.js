#!/usr/bin/env node
/**
 * Simple dev server with live-reload support
 * Usage: node dev-server.js
 * Open: http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const PORT = 3000;
const ROOT = __dirname;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// Track file changes for live-reload
const changedFiles = new Set();
let fileWatcher = null;

function startFileWatcher() {
  fileWatcher = chokidar.watch(ROOT, {
    ignored: ['node_modules', '.git', 'dist'],
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 100 },
  });

  fileWatcher.on('change', (filePath) => {
    const relPath = path.relative(ROOT, filePath);
    changedFiles.add(relPath);
    console.log(`📝 Changed: ${relPath}`);
  });

  fileWatcher.on('error', (err) => console.error('Watcher error:', err));
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }

    let mimeType = getMimeType(filePath);
    
    // Inject live-reload script into HTML files
    if (mimeType === 'text/html') {
      const reloadScript = `
<script>
(function() {
  let lastCheck = Date.now();
  const checkInterval = 1000; // Check every 1s
  
  setInterval(() => {
    if (Date.now() - lastCheck < checkInterval) return;
    lastCheck = Date.now();
    
    fetch(window.location.href, { cache: 'no-store' })
      .then(r => r.text())
      .then(html => {
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');
        const currentETag = document.documentElement.getAttribute('data-reload-etag');
        const newETag = newDoc.documentElement.getAttribute('data-reload-etag');
        
        if (currentETag !== newETag && currentETag !== null) {
          console.log('🔄 Page changed, reloading...');
          window.location.reload();
        }
      })
      .catch(() => {}); // Ignore network errors
  }, checkInterval);
})();
</script>`;
      
      // Add a unique marker to detect changes
      const timestamp = Date.now();
      content = Buffer.from(
        content.toString().replace('</head>', `<script>document.documentElement.setAttribute('data-reload-etag', '${timestamp}')</script>\n</head>`)
      );
      content = Buffer.concat([content, Buffer.from(reloadScript)]);
    }

    res.writeHead(200, { 
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  // CORS headers for audio/media access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let urlPath = req.url === '/' ? 'index.html' : req.url;
  let filePath = path.join(ROOT, urlPath);

  // Security: prevent directory traversal
  if (!path.resolve(filePath).startsWith(path.resolve(ROOT))) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 - Forbidden</h1>');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // Try index.html for directories
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, (err) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 - Not Found</h1>');
        } else {
          serveFile(filePath, res);
        }
      });
    } else if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      serveFile(filePath, res);
    } else {
      serveFile(filePath, res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n✨ Dev server running at http://localhost:${PORT}\n`);
  console.log('📂 Serving from:', ROOT);
  console.log('🔄 Live-reload enabled — changes to .html/.js/.css will auto-refresh\n');
  console.log('Press Ctrl+C to stop\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.error(`   Try: lsof -i :${PORT} to find the process`);
    process.exit(1);
  } else {
    throw err;
  }
});

// Start file watcher for live-reload
try {
  startFileWatcher();
} catch (e) {
  console.warn('⚠️  Live-reload disabled (chokidar not available)');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  if (fileWatcher) fileWatcher.close();
  server.close();
  process.exit(0);
});
