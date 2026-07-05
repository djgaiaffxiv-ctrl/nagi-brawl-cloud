// Meta en la nube — corre en GitHub Actions cada 6 h.
// Agrega los battlelogs del top 100 global + top 100 de España (vía proxy RoyaleAPI)
// y publica data/meta.json: win rates por brawler/modo/mapa y COMPOSICIONES (tríos).
// Mismo formato que consume NAGIBRAWL de escritorio y la versión móvil.
'use strict';
const fs = require('fs');
const path = require('path');

const PROXY = 'https://bsproxy.royaleapi.dev/v1';
const TOKEN = process.env.BS_TOKEN;
const FILE = path.join(__dirname, 'data', 'meta.json');

if (!TOKEN) { console.error('Falta BS_TOKEN'); process.exit(1); }

async function get(p) {
  const r = await fetch(PROXY + p, { headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/json' } });
  if (!r.ok) throw new Error(p + ' -> ' + r.status);
  return r.json();
}

const SHOWDOWN_WIN = { soloShowdown: 4, duoShowdown: 2, trioShowdown: 2 };

function attribute(agg, myTag, item) {
  const b = item.battle || {}, ev = item.event || {};
  const mode = b.mode || ev.mode || 'unknown';
  const map = ev.map || null;
  const ranked = b.type === 'soloRanked' || b.type === 'teamRanked';

  const bump = (id, name, win, draw) => {
    if (id == null) return;
    const k = String(id);
    const rec = agg.brawlers[k] || (agg.brawlers[k] = { id, name, picks: 0, wins: 0, modes: {} });
    rec.picks++; rec.wins += draw ? 0.5 : (win ? 1 : 0);
    if (!rec.name && name) rec.name = name;
    const m = rec.modes[mode] || (rec.modes[mode] = { picks: 0, wins: 0 });
    m.picks++; m.wins += draw ? 0.5 : (win ? 1 : 0);
    if (ranked) {
      const rk = rec.modes.__ranked || (rec.modes.__ranked = { picks: 0, wins: 0 });
      rk.picks++; rk.wins += draw ? 0.5 : (win ? 1 : 0);
    }
    if (map) {
      const mk = mode + '|' + map;
      const mp = agg.maps[mk] || (agg.maps[mk] = { mode, map, brawlers: {} });
      const mb = mp.brawlers[k] || (mp.brawlers[k] = { picks: 0, wins: 0 });
      mb.picks++; mb.wins += draw ? 0.5 : (win ? 1 : 0);
    }
  };

  if (Array.isArray(b.teams)) {
    if (!b.result) return;
    const idx = b.teams.findIndex(t => t.some(p => p.tag === myTag));
    if (idx === -1) return;
    const draw = b.result === 'draw';
    b.teams.forEach((team, i) => {
      const win = !draw && ((i === idx) === (b.result === 'victory'));
      team.forEach(p => p.brawler && bump(p.brawler.id, p.brawler.name, win, draw));
      if (map && team.length === 3 && team.every(p => p.brawler && p.brawler.id != null)) {
        const ids = team.map(p => p.brawler.id).sort((a, c) => a - c);
        const mk = mode + '|' + map;
        const bucket = agg.comps[mk] || (agg.comps[mk] = {});
        const ck = ids.join('-');
        const rec = bucket[ck] || (bucket[ck] = { ids, picks: 0, wins: 0 });
        rec.picks++; rec.wins += draw ? 0.5 : (win ? 1 : 0);
      }
    });
    agg.battles++;
  } else if (typeof b.rank === 'number' && Array.isArray(b.players)) {
    const me = b.players.find(p => p.tag === myTag);
    if (me && me.brawler) { bump(me.brawler.id, me.brawler.name, b.rank <= (SHOWDOWN_WIN[mode] || 4), false); agg.battles++; }
  }
}

(async () => {
  const prev = (() => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; } })();

  const tags = new Set();
  try { (await get('/rankings/global/players?limit=100')).items.forEach(p => tags.add(p.tag)); } catch (e) { console.error('global:', e.message); }
  try { (await get('/rankings/es/players?limit=100')).items.forEach(p => tags.add(p.tag)); } catch (e) { console.error('es:', e.message); }
  const lista = [...tags];
  console.log('jugadores muestra:', lista.length);

  const agg = { computedAt: Date.now(), battles: 0, players: lista.length, brawlers: {}, maps: {}, comps: {} };
  const cola = lista.slice();
  const workers = Array.from({ length: 8 }, async () => {
    while (cola.length) {
      const tag = cola.shift();
      try {
        const log = await get('/players/%23' + tag.replace('#', '') + '/battlelog');
        (log.items || []).forEach(it => { try { attribute(agg, tag, it); } catch {} });
      } catch {}
    }
  });
  await Promise.all(workers);

  if (prev && prev.brawlers) {
    agg.prev = {
      computedAt: prev.computedAt,
      brawlers: Object.fromEntries(Object.entries(prev.brawlers).map(([k, v]) => [k, { picks: v.picks, wins: v.wins }]))
    };
  }

  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(agg));
  console.log('meta.json:', agg.battles, 'batallas,', Object.keys(agg.brawlers).length, 'brawlers,', Object.keys(agg.comps).length, 'mapas con compos');
})();
