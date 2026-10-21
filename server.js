// Perde Ölçü Paneli: index.html'i sunar, tüm veriyi data/projects.json'da tutar.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'projects.json');
const USER = process.env.PANEL_USER || 'perde';
const PASS = process.env.PANEL_PASSWORD;
const MAX = 50 * 1024 * 1024; // görseller JSON içinde olduğu için geniş tutuldu

if (!PASS) { console.error('PANEL_PASSWORD ortam değişkeni gerekli.'); process.exit(1); }
fs.mkdirSync(DATA_DIR, { recursive: true });
const html = fs.readFileSync(path.join(__dirname, 'index.html'));

const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function authed(req) {
  const [type, val] = (req.headers.authorization || '').split(' ');
  if (type !== 'Basic' || !val) return false;
  const [u, ...p] = Buffer.from(val, 'base64').toString().split(':');
  return same(u, USER) && same(p.join(':'), PASS);
}

http.createServer((req, res) => {
  if (!authed(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Perde Paneli", charset="UTF-8"' });
    return res.end('Giriş gerekli');
  }
  if (req.url === '/api/data' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return fs.createReadStream(FILE).on('error', () => res.end('[]')).pipe(res);
  }
  if (req.url === '/api/data' && req.method === 'PUT') {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > MAX) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      let data;
      // eski format: proje listesi; yeni format: { projects, products }
      try {
        data = JSON.parse(Buffer.concat(chunks));
        if (!Array.isArray(data) && !(data && Array.isArray(data.projects) && Array.isArray(data.products))) throw 0;
      }
      catch { res.writeHead(400); return res.end('Geçersiz veri'); }
      // önce geçici dosyaya yaz, sonra taşı: yarım yazılmış dosya veriyi bozmasın
      const tmp = FILE + '.tmp';
      fs.writeFile(tmp, JSON.stringify(data), err => {
        if (err) { res.writeHead(500); return res.end('Kaydedilemedi'); }
        fs.rename(tmp, FILE, err2 => { res.writeHead(err2 ? 500 : 204); res.end(); });
      });
    });
    return;
  }
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log('Perde paneli :' + PORT));
