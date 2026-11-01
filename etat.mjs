// Ce que fait une session Claude Code, déduit des dernières lignes de son journal (.jsonl), sans rien y écrire.
export const ETATS = { tape: 'écrit', lit: 'lit', attend: 'attend une réponse', dort: 'a fini' };
const ECRIT = /^(Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell)$/;
const ATTENTE = /^(AskUserQuestion|ExitPlanMode)$/;
export const DODO = 20 * 60e3;         // plus rien depuis 20 min : la session dort
export const PERMISSION = 60e3;        // un outil lancé sans réponse depuis 1 min : il attend sans doute une autorisation

export function lire(texte) {
  return texte.split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

export function etatSession(lignes, mtime, maintenant = Date.now()) {
  const titre = lignes.findLast(o => o.type === 'custom-title')?.customTitle || lignes.findLast(o => o.type === 'ai-title')?.aiTitle
    || lignes.map(o => o.type === 'user' && !o.isSidechain ? texteDe(o) : '').find(Boolean) || 'Session';
  const cwd = lignes.findLast(o => o.cwd)?.cwd || '';
  const dossier = cwd.split(/[\\/]/).filter(Boolean).at(-1) || '';
  const dernier = lignes.findLast(o => (o.type === 'assistant' || o.type === 'user') && !o.isSidechain);
  const outil = Array.isArray(dernier?.message?.content) ? dernier.message.content.findLast(p => p.type === 'tool_use')?.name : undefined;
  let etat;
  if (maintenant - mtime > DODO) etat = 'dort';
  else if (!dernier) etat = 'lit';
  else if (dernier.type === 'user') etat = 'lit';                       // il vient de recevoir une réponse : il réfléchit
  else if (!outil) etat = 'attend';                                     // il a fini de parler : à vous de répondre
  else if (ATTENTE.test(outil) || maintenant - mtime > PERMISSION) etat = 'attend';
  else etat = ECRIT.test(outil) ? 'tape' : 'lit';
  return { titre: titre.slice(0, 80), dossier, etat, outil: etat === 'dort' ? undefined : outil, depuis: mtime };
}

// Le texte d'un message de l'utilisateur (une chaîne, ou des morceaux dont certains sont du texte), sans balises.
function texteDe(o) {
  const c = o.message?.content;
  const t = typeof c === 'string' ? c : Array.isArray(c) ? c.filter(p => p.type === 'text').map(p => p.text).join(' ') : '';
  return t.replace(/<[^>]+>[\s\S]*?<\/[^>]+>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}
