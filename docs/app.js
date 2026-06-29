'use strict';
// Lee los datos que el robot sube a la nube y los pinta. Sin token (la nube es pública).
var RAW = 'https://raw.githubusercontent.com/djgaiaffxiv-ctrl/nagi-brawl-cloud/main/data/';
var TAG = '9R8PPG822'; // cuenta principal

var meta = {}, profiles = {}, battlesMap = {}, club = null, profile = null, battles = [];
var activeTag = TAG, currentTab = 'brawlers';

var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function fmt(n) { return Number(n || 0).toLocaleString('es-ES'); }
function portraitUrl(id) { return 'https://cdn.brawlify.com/brawlers/borderless/' + id + '.png'; }
function iconUrl(id) { return 'https://cdn.brawlify.com/profile-icons/regular/' + (id || 28000000) + '.png'; }
function rarityColor(id) { return (meta[id] && meta[id].color) || '#3fe0c8'; }
function brawlerName(id) { return (meta[id] && meta[id].name) || ('#' + id); }
function normName(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').trim(); }

var MODE_ES = { gemGrab: 'Atrapagemas', brawlBall: 'Balón Brawl', soloShowdown: 'Supervivencia', duoShowdown: 'Superv. Dúo', showdown: 'Supervivencia', bounty: 'Caza Estelar', heist: 'Atraco', hotZone: 'Zona Restringida', knockout: 'Noqueo', duels: 'Duelos', wipeout: 'Aniquilación', brawlBall5v5: 'Balón 5v5', basketBrawl: 'Basket', volleyBrawl: 'Vóley' };
function prettyMode(m) { if (!m) return 'Partida'; if (MODE_ES[m]) return MODE_ES[m]; return m.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); }).trim(); }

var RANK_ES = { Bronze: 'Bronce', Silver: 'Plata', Gold: 'Oro', Diamond: 'Diamante', Mythic: 'Mítico', Legendary: 'Legendario', Master: 'Maestro', Masters: 'Maestro', Pro: 'Pro' };
var RANK_FILE = { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', DIAMOND: 'Diamond', MYTHIC: 'Mythic', LEGENDARY: 'Legendary', MASTER: 'Masters', MASTERS: 'Masters', PRO: 'Pro' };
var RANK_COLOR = { Bronce: '#cd7f4f', Plata: '#cdd3dc', Oro: '#ffcb3d', Diamante: '#46d6ea', Mítico: '#c45cff', Legendario: '#ff5e72', Maestro: '#ff3b3b', Pro: '#ff2ba0' };
function rankChip(name) {
  if (!name) return '';
  var m = String(name).match(/^([A-Za-z]+)\s*([IVX]+)?/i);
  var baseEs = m ? (RANK_ES[m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()] || m[1]) : name;
  var num = m && m[2] ? ' ' + m[2].toUpperCase() : '';
  var file = m && RANK_FILE[m[1].toUpperCase()];
  var ic = file ? '<img src="https://cdn.brawlify.com/ranked/regular/' + file + '.png"/>' : '';
  return '<span class="rank-chip" style="--rc:' + (RANK_COLOR[baseEs] || '#3fe0c8') + '">' + ic + esc(baseEs + num) + '</span>';
}

function classify(r) {
  if (r.result === 'victory') return { cls: 'win', w: 1, l: 0, txt: 'VICTORIA' };
  if (r.result === 'defeat') return { cls: 'loss', w: 0, l: 1, txt: 'DERROTA' };
  if (r.result === 'draw') return { cls: 'draw', w: 0, l: 0, txt: 'EMPATE' };
  if (typeof r.rank === 'number') { var win = r.rank <= 4; return { cls: win ? 'win' : 'loss', w: win ? 1 : 0, l: win ? 0 : 1, txt: 'RANGO #' + r.rank }; }
  return { cls: 'draw', w: 0, l: 0, txt: '' };
}
function pct(w, l) { var t = w + l; return t ? Math.round(w / t * 100) : 0; }
function parseT(iso) { var m = String(iso).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null; }
function pad2(n) { return String(n).padStart(2, '0'); }
function dayKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function dayLabel(d) { var now = new Date(); if (dayKey(d) === dayKey(now)) return 'Hoy'; if (dayKey(d) === dayKey(new Date(now.getTime() - 86400000))) return 'Ayer'; return d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' }); }

// ---------- Carga ----------
function getJson(url) { return fetch(url + '?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }

function boot() {
  Promise.all([
    getJson('brawlers-meta.json').catch(function () { return {}; }),
    getJson(RAW + 'profile.json').catch(function () { return {}; }),
    getJson(RAW + 'battles.json').catch(function () { return {}; }),
    getJson(RAW + 'club.json').catch(function () { return null; })
  ]).then(function (res) {
    meta = res[0] || {}; profiles = res[1] || {}; battlesMap = res[2] || {}; club = res[3] || null;
    renderSwitch();
    if (!profiles[activeTag]) activeTag = profiles[TAG] ? TAG : (Object.keys(profiles)[0] || TAG);
    setAccount(activeTag);
  }).catch(function (e) {
    $('view').innerHTML = '<div class="loading err">No se pudo cargar la nube: ' + esc(e.message) + '</div>';
  });
}

function setAccount(tag) {
  activeTag = tag;
  profile = profiles[tag] || null;
  battles = battlesMap[tag] || [];
  renderHeader();
  renderSwitch();
  show(currentTab);
}

function renderSwitch() {
  var keys = Object.keys(profiles);
  if (keys.length < 2) { $('switch').innerHTML = ''; return; }
  $('switch').innerHTML = keys.map(function (k) {
    var p = profiles[k];
    return '<button class="sw' + (k === activeTag ? ' active' : '') + '" data-tag="' + esc(k) + '">' +
      '<img src="' + iconUrl(p.icon) + '"/><span>' + esc((p.name || k).slice(0, 10)) + '</span></button>';
  }).join('');
}

function renderHeader() {
  if (!profile) { $('pstrip').innerHTML = '<span class="ps-name">—</span>'; return; }
  $('pstrip').innerHTML =
    '<img class="logo" style="width:30px;height:30px;border-radius:8px" src="' + iconUrl(profile.icon) + '"/>' +
    '<span class="ps-name">' + esc(profile.name) + '</span>' +
    (profile.ranked && profile.ranked.name ? rankChip(profile.ranked.name) : '') +
    (profile.club ? '<span class="ps-club">🛡 ' + esc(profile.club) + '</span>' : '') +
    '<span class="ps-cup">🏆 ' + fmt(profile.trophies) + '</span>';
  if (profile.updated) { var d = new Date(profile.updated); $('updated').textContent = 'Nube · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
}

// ---------- Vistas ----------
function show(tab) {
  currentTab = tab;
  var btns = document.querySelectorAll('.tab'); for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.tab === tab);
  if (tab === 'brawlers') renderBrawlers();
  else if (tab === 'history') renderHistory();
  else if (tab === 'ponde') renderPonde();
  else if (tab === 'club') renderClub();
}

var ROLE_ES = { president: 'Líder', vicePresident: 'Vicepresidente', senior: 'Sénior', member: 'Miembro' };
var GOLD_NAMES = { polloinflado: 1, salmonprimavera: 1 };
function renderClub() {
  if (!club || !club.members) { $('view').innerHTML = '<div class="loading">El club aún no está en la nube (espera al próximo sondeo).</div>'; return; }
  var members = club.members.slice().sort(function (a, b) { return b.trophies - a.trophies; });
  var rows = members.map(function (m, i) {
    var gold = GOLD_NAMES[normName(m.name)] ? ' gold' : '';
    return '<div class="crow' + gold + '"><span class="crank">' + (i + 1) + '</span>' +
      '<img class="cphoto" loading="lazy" src="' + iconUrl(m.icon) + '"/>' +
      '<div class="cmain"><span class="cname">' + esc(m.name) + '</span><span class="crole">' + esc(ROLE_ES[m.role] || m.role || '') + '</span></div>' +
      '<span class="ctro">' + fmt(m.trophies) + ' 🏆</span></div>';
  }).join('');
  $('view').innerHTML =
    '<div class="summary"><div class="stat accent"><div class="stat-num">' + fmt(club.trophies) + '</div><div class="stat-lbl">Copas club</div></div>' +
    '<div class="stat"><div class="stat-num">' + members.length + '</div><div class="stat-lbl">Miembros</div></div>' +
    '<div class="stat"><div class="stat-num">' + fmt(club.requiredTrophies || 0) + '</div><div class="stat-lbl">Entrada</div></div>' +
    '<div class="stat"><div class="stat-num" style="font-size:15px">' + esc(club.name || '') + '</div><div class="stat-lbl">Club</div></div></div>' +
    '<div class="clublist">' + rows + '</div>';
}

function renderBrawlers() {
  if (!profile || !profile.brawlers) { $('view').innerHTML = '<div class="loading">Sin datos de brawlers todavía.</div>'; return; }
  var brs = profile.brawlers.slice().sort(function (a, b) { return b.trophies - a.trophies; });
  var total = 0, p1 = 0, p2 = 0;
  brs.forEach(function (b) { total += (b.trophies || 0); if (b.trophies >= 1000) p1++; if (b.trophies >= 2000) p2++; });
  var grid = brs.map(function (b) {
    return '<div class="bcard" style="--rar:' + rarityColor(b.id) + '"><div class="bportbox"><img loading="lazy" src="' + portraitUrl(b.id) + '"/>' +
      '<span class="blvl">' + (b.power != null ? b.power : '?') + '</span></div><div class="bname">' + esc(b.name) + '</div><div class="btro">🏆 ' + fmt(b.trophies) + '</div></div>';
  }).join('');
  $('view').innerHTML =
    '<div class="summary"><div class="stat accent"><div class="stat-num">' + fmt(total) + '</div><div class="stat-lbl">Total copas</div></div>' +
    '<div class="stat"><div class="stat-num">' + brs.length + '</div><div class="stat-lbl">Brawlers</div></div>' +
    '<div class="stat"><div class="stat-num" style="color:var(--gold)">' + p1 + '</div><div class="stat-lbl">A 1000+</div></div>' +
    '<div class="stat"><div class="stat-num" style="color:var(--turq)">' + p2 + '</div><div class="stat-lbl">A 2000+</div></div></div>' +
    '<div class="bgrid">' + grid + '</div>';
}

function teamsLine(r, meTag) {
  var allies = (r.mates || []).filter(function (m) { return (m.t || '') !== meTag; });
  var enemies = r.enemies || [];
  if (!allies.length && !enemies.length) return '';
  var chip = function (p, side) { var img = p.b != null ? '<img loading="lazy" src="' + portraitUrl(p.b) + '"/>' : ''; return '<span class="hpl ' + side + '">' + img + esc(p.n || brawlerName(p.b)) + '</span>'; };
  var h = '<div class="hteams">';
  if (allies.length) h += '<div class="hside">' + allies.map(function (p) { return chip(p, 'al'); }).join('') + '</div>';
  if (allies.length && enemies.length) h += '<span class="hvs">VS</span>';
  if (enemies.length) h += '<div class="hside">' + enemies.map(function (p) { return chip(p, 'en'); }).join('') + '</div>';
  return h + '</div>';
}

function renderHistory() {
  if (!battles.length) { $('view').innerHTML = '<div class="loading">Aún no hay partidas en la nube.</div>'; return; }
  var meTag = (profile && profile.tag ? profile.tag : '#' + TAG).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  var groups = [], idx = {};
  battles.forEach(function (r) { var d = parseT(r.time), k = d ? dayKey(d) : '?'; if (idx[k] === undefined) { idx[k] = groups.length; groups.push({ d: d, items: [] }); } groups[idx[k]].items.push(r); });
  var html = '';
  groups.forEach(function (g) {
    html += '<div class="hday">' + esc(g.d ? dayLabel(g.d) : '—') + '</div>';
    g.items.forEach(function (r) {
      var c = classify(r), tc = r.trophyChange, t = parseT(r.time);
      html += '<div class="hrow ' + c.cls + '"><div class="htop">' +
        (r.brawlerId != null ? '<img class="hbr" loading="lazy" src="' + portraitUrl(r.brawlerId) + '"/>' : '') +
        '<div class="hmid"><div class="hmode">' + esc(prettyMode(r.mode)) + '</div><div class="hmap">' + esc(r.map || '') + '</div></div>' +
        '<div class="hverdict ' + c.cls + '">' + c.txt + (typeof tc === 'number' ? ' <span class="hv-chg">' + (tc > 0 ? '+' : '') + tc + '</span>' : '') + '</div>' +
        '<span class="htot">' + (r.trophies != null ? '🏆 ' + fmt(r.trophies) : '') + '</span>' +
        '<span class="htime">' + (t ? t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '') + '</span>' +
        '</div>' + teamsLine(r, meTag) + '</div>';
    });
  });
  $('view').innerHTML = html;
}

var GOLD = ['polloinflado', 'salmonprimavera'];
function renderPonde() {
  // Trío = partidas donde mis compañeros incluyen a Pollo y Salmón (por nombre).
  var trio = battles.filter(function (r) {
    if (!r.mates || r.mates.length < 3) return false;
    var names = r.mates.map(function (m) { return normName(m.n); });
    return GOLD.every(function (g) { return names.indexOf(g) !== -1; });
  });
  if (!trio.length) { $('view').innerHTML = '<div class="loading">Aún no hay partidas en trío (tú + Pollo + Salmón) registradas.<br>Se irán llenando según juguéis juntos.</div>'; return; }
  var w = 0, l = 0, net = 0; trio.forEach(function (r) { var c = classify(r); w += c.w; l += c.l; if (typeof r.trophyChange === 'number') net += r.trophyChange; });
  var comps = {};
  trio.forEach(function (r) {
    var ids = r.mates.map(function (m) { return m.b; }).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
    if (ids.length < 3) return; var k = ids.join('-'); var c = comps[k] || (comps[k] = { ids: ids, g: 0, w: 0, l: 0 }); var cc = classify(r); c.g++; c.w += cc.w; c.l += cc.l;
  });
  var compArr = Object.keys(comps).map(function (k) { return comps[k]; }).sort(function (a, b) { return (pct(b.w, b.l) - pct(a.w, a.l)) || (b.g - a.g); });
  var maps = {};
  trio.forEach(function (r) { var mp = r.map || '?'; var x = maps[mp] || (maps[mp] = { map: mp, g: 0, w: 0, l: 0 }); var c = classify(r); x.g++; x.w += c.w; x.l += c.l; });
  var mapArr = Object.keys(maps).map(function (k) { return maps[k]; }).sort(function (a, b) { return (pct(b.w, b.l) - pct(a.w, a.l)) || (b.g - a.g); });
  $('view').innerHTML =
    '<div class="summary"><div class="stat"><div class="stat-num">' + trio.length + '</div><div class="stat-lbl">Partidas trío</div></div>' +
    '<div class="stat accent"><div class="stat-num">' + pct(w, l) + '%</div><div class="stat-lbl">' + w + 'V / ' + l + 'D</div></div>' +
    '<div class="stat"><div class="stat-num ' + (net >= 0 ? 'win' : 'loss') + '">' + (net >= 0 ? '+' : '') + fmt(net) + '</div><div class="stat-lbl">Trofeos netos</div></div>' +
    '<div class="stat"><div class="stat-num">' + mapArr.length + '</div><div class="stat-lbl">Mapas</div></div></div>' +
    '<div class="sec-h">🏆 Mejores composiciones</div>' +
    compArr.slice(0, 6).map(function (c) {
      return '<div class="comp"><div class="comp-imgs">' + c.ids.map(function (id) { return '<img src="' + portraitUrl(id) + '" style="border-color:' + rarityColor(id) + '"/>'; }).join('') +
        '</div><div class="comp-wr"><b class="' + (pct(c.w, c.l) >= 50 ? 'win' : 'loss') + '">' + pct(c.w, c.l) + '%</b><span>' + c.g + ' part. · ' + c.w + 'V/' + c.l + 'D</span></div></div>';
    }).join('') +
    '<div class="sec-h">🗺️ Mejores mapas</div>' +
    mapArr.slice(0, 8).map(function (m) { return '<div class="comp"><span style="flex:1">' + esc(m.map) + '</span><b class="' + (pct(m.w, m.l) >= 50 ? 'win' : 'loss') + '">' + pct(m.w, m.l) + '%</b>&nbsp;<span style="color:var(--muted);font-size:11px">' + m.g + 'p</span></div>'; }).join('');
}

document.querySelector('.tabs').addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) show(b.dataset.tab); });
$('switch').addEventListener('click', function (e) { var b = e.target.closest('.sw'); if (b) setAccount(b.dataset.tag); });
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(function () {}); }
boot();
setInterval(boot, 120000); // refresca de la nube cada 2 min
