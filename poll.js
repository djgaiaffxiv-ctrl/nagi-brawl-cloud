// Robot 24/7 de NAGI BRAWL — corre en GitHub Actions cada 5 min.
// Lee el historial de combates vía el proxy de RoyaleAPI y lo acumula en data/battles.json.
// No necesita dependencias (usa el fetch nativo de Node 20).
const fs = require('fs');
const path = require('path');

const PROXY = 'https://bsproxy.royaleapi.dev/v1';
const FILE = path.join(__dirname, 'data', 'battles.json');
const PROFILE_FILE = path.join(__dirname, 'data', 'profile.json');

function cleanTag(t) { return String(t || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^#/, ''); }
function normTag(t) { return String(t || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase(); }
function battlePlayers(b) { if (Array.isArray(b.teams)) return b.teams; if (Array.isArray(b.players)) return [b.players]; return []; }

// Construye el registro EXACTAMENTE igual que la app (mismo 'key' para que se fusione sin duplicar).
function toRecord(item, meNorm) {
  const b = item.battle || {}, ev = item.event || {};
  const teams = battlePlayers(b);
  let myBr = null, mates = [], enemies = [];
  const info = function (pl) { return { t: normTag(pl.tag), n: pl.name || '', b: (pl.brawler && pl.brawler.id != null ? pl.brawler.id : null) }; };
  const enemy = function (pl) { return { n: pl.name || '', b: (pl.brawler && pl.brawler.id != null ? pl.brawler.id : null) }; };
  if (teams.length === 2) {
    let myIdx = -1;
    teams.forEach(function (tm, i) { if ((tm || []).some(function (pl) { return normTag(pl.tag) === meNorm; })) myIdx = i; });
    if (myIdx >= 0) {
      (teams[myIdx] || []).forEach(function (pl) { if (normTag(pl.tag) === meNorm) myBr = pl.brawler || null; });
      mates = (teams[myIdx] || []).map(info);
      enemies = (teams[1 - myIdx] || []).map(enemy);
    }
  } else if (teams.length === 1) {
    (teams[0] || []).forEach(function (pl) { if (normTag(pl.tag) === meNorm) myBr = pl.brawler || null; });
    enemies = (teams[0] || []).filter(function (pl) { return normTag(pl.tag) !== meNorm; }).map(enemy);
    mates = (teams[0] || []).filter(function (pl) { return normTag(pl.tag) === meNorm; }).map(info);
  }
  myBr = myBr || {};
  const mode = b.mode || ev.mode || '', map = ev.map || '';
  return {
    key: (item.battleTime || '') + '|' + mode + '|' + map + '|' + (myBr.id != null ? myBr.id : ''),
    time: item.battleTime || '', mode: mode, map: map,
    result: b.result || null, rank: (typeof b.rank === 'number' ? b.rank : null),
    trophyChange: (typeof b.trophyChange === 'number' ? b.trophyChange : null),
    brawlerId: (myBr.id != null ? myBr.id : null), brawlerName: myBr.name || null,
    power: (myBr.power != null ? myBr.power : null), trophies: (myBr.trophies != null ? myBr.trophies : null),
    mates: mates, enemies: enemies
  };
}

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; } }
function save(m) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(m)); }

function mergeInto(map, key, records) {
  let all = map[key] || [];
  const byKey = {}; all.forEach(function (r) { byKey[r.key] = r; });
  records.forEach(function (r) {
    if (!r || !r.key) return;
    if (!byKey[r.key]) { byKey[r.key] = r; all.push(r); }
    else {
      const ex = byKey[r.key];
      if (ex.trophies == null && r.trophies != null) ex.trophies = r.trophies;
      if ((!ex.mates || !ex.mates.length) && r.mates && r.mates.length) ex.mates = r.mates;
      if ((!ex.enemies || !ex.enemies.length) && r.enemies && r.enemies.length) ex.enemies = r.enemies;
    }
  });
  all.sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });
  map[key] = all.slice(0, 50000);
}

async function fetchProfile(t, token) {
  const res = await fetch(PROXY + '/players/%23' + t, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
  if (!res.ok) return null;
  const d = await res.json();
  return {
    name: d.name, tag: d.tag, trophies: d.trophies, highest: d.highestTrophies,
    icon: (d.icon && d.icon.id) || null,
    club: (d.club && d.club.name) || null, clubTag: (d.club && d.club.tag) || null,
    ranked: { name: d.rankedRankName || null, elo: d.rankedElo || null },
    maxRanked: { name: d.highestAllTimeRankedRankName || null, elo: d.highestAllTimeRankedElo || null },
    brawlers: (d.brawlers || []).map(function (b) { return { id: b.id, name: b.name, trophies: b.trophies, highest: b.highestTrophies, power: b.power, rank: b.rank }; }),
    updated: new Date().toISOString()
  };
}
function loadProfiles() { try { return JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8')); } catch (e) { return {}; } }
function saveProfiles(m) { fs.mkdirSync(path.dirname(PROFILE_FILE), { recursive: true }); fs.writeFileSync(PROFILE_FILE, JSON.stringify(m)); }

(async function () {
  const token = process.env.BS_TOKEN;
  const tags = (process.env.BS_TAGS || process.env.BS_TAG || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!token || !tags.length) { console.error('Faltan BS_TOKEN o BS_TAGS'); process.exit(1); }
  const map = load();
  const profiles = loadProfiles();
  for (const tag of tags) {
    const t = cleanTag(tag);
    try {
      const res = await fetch(PROXY + '/players/%23' + t + '/battlelog', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const recs = (data.items || []).map(function (it) { return toRecord(it, normTag(t)); });
        mergeInto(map, t, recs);
        console.log(t + ': ' + recs.length + ' leídas, total acumulado ' + (map[t] ? map[t].length : 0));
      } else { console.error('battlelog HTTP ' + res.status + ' para ' + t); }
      const prof = await fetchProfile(t, token);
      if (prof) { profiles[t] = prof; console.log(t + ': perfil ' + prof.name + ' (' + prof.trophies + ' copas)'); }
    } catch (e) { console.error('Error ' + t + ': ' + (e.message || e)); }
  }
  save(map);
  saveProfiles(profiles);
  console.log('Hecho.');
})();
