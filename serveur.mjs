// Le bureau des agents : node serveur.mjs, puis ouvrir l'adresse affichée. Lecture seule, 127.0.0.1 seulement.
import { createServer } from 'node:http';
import { readdirSync, statSync, openSync, readSync, closeSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { lire, etatSession } from './etat.mjs';

const ICI = fileURLToPath(new URL('.', import.meta.url));
const PROJETS = process.env.BUREAU_PROJETS || join(homedir(), '.claude', 'projects');
const PORT = +(process.env.PORT || 4777);
const FENETRE = 12 * 3600e3;   // sessions touchées dans les 12 dernières heures
const QUEUE = 256 * 1024, TETE = 64 * 1024;   // on ne lit que le début et la fin de chaque journal

// Le début (le titre y est souvent) et la fin (l'état) d'un journal ; les lignes coupées sont ignorées par lire().
function morceaux(fichier, taille) {
  if (taille <= QUEUE + TETE) return readFileSync(fichier, 'utf8');
  const lit = (pos, n) => { const b = Buffer.alloc(n), fd = openSync(fichier, 'r'); try { readSync(fd, b, 0, n, pos); } finally { closeSync(fd); } return b.toString('utf8'); };
  return lit(0, TETE) + '\n' + lit(taille - QUEUE, QUEUE);
}

export function sessions(maintenant = Date.now()) {
  const out = [];
  let projets = [];
  try { projets = readdirSync(PROJETS, { withFileTypes: true }).filter(d => d.isDirectory()); } catch { return out; }
  for (const p of projets) {
    let fichiers = [];
    try { fichiers = readdirSync(join(PROJETS, p.name)).filter(f => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of fichiers) {
      const chemin = join(PROJETS, p.name, f), st = statSync(chemin);
      if (maintenant - st.mtimeMs > FENETRE) continue;
      out.push({ id: f.slice(0, 8), ...etatSession(lire(morceaux(chemin, st.size)), st.mtimeMs, maintenant) });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));   // chacun garde sa place d'un rafraîchissement à l'autre
}

const PAGES = { '/': ['page.html', 'text/html'], '/page.js': ['page.js', 'text/javascript'], '/page.css': ['page.css', 'text/css'] };
const hoteOk = h => new RegExp(`^(127\\.0\\.0\\.1|localhost):${PORT}$`).test(h || '');   // contre le « DNS rebinding »

export const serveur = createServer((req, res) => {
  const entetes = { 'Content-Security-Policy': "default-src 'self'", 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
  if (req.method !== 'GET' || !hoteOk(req.headers.host)) { res.writeHead(403, entetes).end(); return; }
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/etat') { res.writeHead(200, { ...entetes, 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(sessions())); return; }
  const page = PAGES[url.pathname];
  if (!page) { res.writeHead(404, entetes).end(); return; }
  res.writeHead(200, { ...entetes, 'Content-Type': page[1] + '; charset=utf-8' }).end(readFileSync(join(ICI, page[0])));
});

if (realpathSync(process.argv[1] || '.') === realpathSync(fileURLToPath(import.meta.url))) {
  serveur.listen(PORT, '127.0.0.1', () => console.log(`Le bureau des agents : http://127.0.0.1:${PORT}  (Ctrl+C pour arrêter)`));
}
