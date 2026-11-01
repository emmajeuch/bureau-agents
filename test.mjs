// node test.mjs : les états déduits des journaux, puis le serveur sur un faux dossier de projets.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request } from 'node:http';
import { etatSession, lire, DODO, PERMISSION } from './etat.mjs';

const T = Date.parse('2026-11-01T22:00:00Z');
const titre = { type: 'custom-title', customTitle: 'Corriger les rappels' };
const outil = name => ({ type: 'assistant', cwd: 'C:\\code\\mon-app', message: { content: [{ type: 'text', text: '…' }, { type: 'tool_use', name }] } });
const dit = { type: 'assistant', message: { content: [{ type: 'text', text: "C'est fait." }] } };
const resultat = { type: 'user', message: { content: [{ type: 'tool_result' }] } };

assert.deepEqual(etatSession([titre, outil('Edit')], T - 5e3, T), { titre: 'Corriger les rappels', dossier: 'mon-app', etat: 'tape', outil: 'Edit', depuis: T - 5e3 });
assert.equal(etatSession([titre, outil('Grep')], T - 5e3, T).etat, 'lit');
assert.equal(etatSession([titre, outil('Edit'), resultat], T - 5e3, T).etat, 'lit');           // il réfléchit
assert.equal(etatSession([titre, dit], T - 5e3, T).etat, 'attend');                            // à l'utilisateur de répondre
assert.equal(etatSession([titre, outil('AskUserQuestion')], T - 5e3, T).etat, 'attend');
assert.equal(etatSession([titre, outil('Bash')], T - PERMISSION - 1, T).etat, 'attend');       // autorisation en attente
assert.equal(etatSession([titre, outil('Edit')], T - DODO - 1, T).etat, 'dort');
assert.equal(etatSession([{ ...outil('Edit'), isSidechain: true }, dit], T - 5e3, T).etat, 'attend');   // un sous-agent ne compte pas
assert.equal(etatSession([{ type: 'user', message: { content: '<cmd>x</cmd> Range mes   saves' } }], T, T).titre, 'Range mes saves');
assert.equal(etatSession([{ type: 'user', message: { content: [{ type: 'image' }, { type: 'text', text: 'Corrige le bug' }] } }], T, T).titre, 'Corrige le bug');
assert.equal(etatSession([{ type: 'ai-title', aiTitle: 'Plan du jeu' }, dit], T, T).titre, 'Plan du jeu');
assert.equal(lire('{"a":1}\n{coupé\n{"b":2}').length, 2);

// Le serveur : un faux dossier de projets, une session récente, une ancienne.
const base = mkdtempSync(join(tmpdir(), 'bureau-test-')), p = join(base, 'C--code-mon-app');
mkdirSync(p);
writeFileSync(join(p, 'aaaaaaaa-1.jsonl'), [titre, outil('Write')].map(o => JSON.stringify(o)).join('\n'));
writeFileSync(join(p, 'bbbbbbbb-2.jsonl'), JSON.stringify(dit));
utimesSync(join(p, 'bbbbbbbb-2.jsonl'), new Date(Date.now() - 2 * 86400e3), new Date(Date.now() - 2 * 86400e3));
process.env.BUREAU_PROJETS = base; process.env.PORT = '4799';
const avant = readFileSync(join(p, 'aaaaaaaa-1.jsonl'), 'utf8');
const { serveur } = await import('./serveur.mjs');
await new Promise(ok => serveur.listen(4799, '127.0.0.1', ok));
assert.equal(serveur.address().address, '127.0.0.1');
const get = (chemin, host = '127.0.0.1:4799', method = 'GET') => new Promise((ok, ko) => request({ host: '127.0.0.1', port: 4799, path: chemin, method, headers: { host } }, r => {
  let b = ''; r.on('data', d => b += d).on('end', () => ok({ code: r.statusCode, b, csp: r.headers['content-security-policy'] }));
}).on('error', ko).end());
const e = await get('/etat');
assert.equal(e.code, 200);
assert.deepEqual(JSON.parse(e.b).map(s => [s.id, s.titre, s.etat]), [['aaaaaaaa', 'Corriger les rappels', 'tape']]);   // l'ancienne n'apparaît pas
assert.equal((await get('/')).csp, "default-src 'self'");
assert.equal((await get('/etat', 'evil.example:4799')).code, 403);   // autre nom d'hôte refusé
assert.equal((await get('/etat', undefined, 'POST')).code, 403);
assert.equal((await get('/../serveur.mjs')).code, 404);
assert.equal(readFileSync(join(p, 'aaaaaaaa-1.jsonl'), 'utf8'), avant);   // rien n'a été écrit
serveur.close();
rmSync(base, { recursive: true, force: true });

// Le code n'écrit rien et ne parle qu'à 127.0.0.1.
for (const f of ['serveur.mjs', 'etat.mjs', 'page.js']) {
  const code = readFileSync(new URL(f, import.meta.url), 'utf8');
  assert.ok(!/writeFile|appendFile|unlink|rmSync|rename|mkdir|node:(net|https|dgram|tls)/.test(code), f);
}
assert.ok(!/fetch\((?!'\/etat')/.test(readFileSync(new URL('page.js', import.meta.url), 'utf8')));
console.log('ok');
