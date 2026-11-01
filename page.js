// Le dessin du bureau : tout est tracé en code, en gros pixels (un « pixel » = P points d'écran).
const P = 4, COL = 4, HAUT = 240;
const cv = document.getElementById('bureau'), g = cv.getContext('2d');
const LIBELLE = { tape: 'écrit', lit: 'lit', attend: 'attend une réponse', dort: 'a fini' };
const PEAUX = ['#f2c6a0', '#d9a07a', '#a8714d', '#7a4e33'], HABITS = ['#5b8def', '#e0645c', '#53b07f', '#c58be8', '#f0a63c', '#4fb3bf'];
let sessions = [], t = 0;

const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * P, y * P, w * P, h * P); };
const hache = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function sol() {
  for (let y = 0; y < cv.height / P; y += 8) for (let x = 0; x < cv.width / P; x += 8)
    px(x, y, 8, 8, (x + y) % 16 ? '#2a2d36' : '#2f323c');
}

function poste(cx, cy, s, i) {
  const h = hache(s.id), peau = PEAUX[h % 4], habit = HABITS[h % HABITS.length], dort = s.etat === 'dort';
  // le bureau et l'écran
  px(cx - 22, cy + 4, 44, 4, '#8a6a4a'); px(cx - 22, cy + 8, 44, 2, '#6d5238');
  px(cx - 20, cy + 10, 2, 8, '#6d5238'); px(cx + 18, cy + 10, 2, 8, '#6d5238');
  px(cx - 10, cy - 10, 20, 13, '#15171c');
  const ecran = dort ? '#22252c' : s.etat === 'tape' ? (t % 2 ? '#6fd3a0' : '#58c08b') : s.etat === 'attend' ? '#f0c24b' : '#7fb2f0';
  px(cx - 9, cy - 9, 18, 10, ecran);
  if (!dort) for (let l = 0; l < 3; l++) px(cx - 7, cy - 7 + l * 3, 6 + ((h >> l) + (s.etat === 'tape' ? t : 0)) % 8, 1, '#1b2b24');
  px(cx - 2, cy + 3, 4, 1, '#15171c');
  // le personnage, de dos, devant l'écran
  const y = cy + 14 + (s.etat === 'lit' && t % 4 < 2 ? 1 : 0);
  px(cx - 6, y + 6, 12, 9, habit);                                  // le buste
  px(cx - 4, y - 2, 8, 8, dort ? peau : peau);                       // la tête
  px(cx - 4, y - 3, 8, 3, ['#3b2a1f', '#1d1d1d', '#a0522d', '#d8b25c'][h >> 3 & 3]);   // les cheveux
  if (s.etat === 'tape') { px(cx - 8 + (t % 2) * 2, y + 4, 3, 3, peau); px(cx + 5 - (t % 2) * 2, y + 4, 3, 3, peau); }
  if (s.etat === 'lit') px(cx + 6, y + 3, 5, 6, '#f4f1e8');          // une feuille
  if (s.etat === 'attend') { px(cx + 6, y - 8 - (t % 2), 3, 12, habit); px(cx + 6, y - 11 - (t % 2), 3, 3, peau); }   // la main levée
  if (dort) { px(cx - 5, y - 4, 10, 3, '#3b2a1f'); g.fillStyle = '#9aa0ad'; g.font = `${4 * P}px monospace`; g.fillText('z' + (t % 3 ? 'z' : 'Z'), (cx + 8) * P, (cy - 12) * P); }
  // la bulle : la tâche et ce qu'il fait
  const titre = s.titre.length > 30 ? s.titre.slice(0, 29) + '…' : s.titre;
  const ligne2 = LIBELLE[s.etat] + (s.outil ? ` · ${s.outil.replace(/^mcp__[^_]+__/, '')}` : '');
  g.font = '13px system-ui, sans-serif';
  const w = Math.max(g.measureText(titre).width, g.measureText(ligne2).width) + 16, bx = cx * P - w / 2, by = (cy - 30) * P;
  g.fillStyle = dort ? '#3a3d47' : '#f7f4ec'; g.beginPath(); g.roundRect(bx, by, w, 40, 8); g.fill();
  g.fillStyle = dort ? '#9aa0ad' : '#24262d'; g.fillText(titre, bx + 8, by + 16);
  g.fillStyle = dort ? '#9aa0ad' : { tape: '#2e8b57', lit: '#2f6db5', attend: '#b7791f' }[s.etat]; g.fillText(ligne2, bx + 8, by + 32);
}

function dessiner() {
  const lignes = Math.max(1, Math.ceil(sessions.length / COL));
  const h = Math.max(560, lignes * HAUT + 40);
  if (cv.height !== h) cv.height = h;
  sol();
  sessions.forEach((s, i) => poste(30 + (i % COL) * 60, 50 + Math.floor(i / COL) * 60, s, i));
}

// ?demo : des sessions inventées, pour essayer ou faire une capture sans montrer les vraies.
const DEMO = [['a1', 'Fix the login form', 'tape', 'Edit'], ['b2', 'Write the README', 'lit', 'Read'],
  ['c3', 'Plan the next release', 'attend'], ['d4', 'Refactor the parser', 'tape', 'Bash'], ['e5', 'Update dependencies', 'dort']]
  .map(([id, titre, etat, outil]) => ({ id, titre, etat, outil }));

async function rafraichir() {
  if (new URLSearchParams(location.search).has('demo')) sessions = DEMO;
  else try { sessions = await (await fetch('/etat')).json(); } catch { return; }
  const n = k => sessions.filter(s => s.etat === k).length;
  document.getElementById('resume').textContent = `${sessions.length} session${sessions.length > 1 ? 's' : ''} · ${n('tape')} écrit · ${n('lit')} lit · ${n('attend')} attend · ${n('dort')} a fini`;
  document.getElementById('vide').hidden = sessions.length > 0;
}

rafraichir(); setInterval(rafraichir, 3000);
setInterval(() => { t++; dessiner(); }, 400);
