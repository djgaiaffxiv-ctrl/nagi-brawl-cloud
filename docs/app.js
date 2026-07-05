'use strict';
/* ============================================================
   NAGIBRAWL móvil — lee los datos del robot de la nube (públicos,
   sin token): battles.json, profile.json, club.json y meta.json.
   Port de la app de escritorio NAGIBRAWL. © 2026 NAGI STUDIOS
   ============================================================ */
const RAW = 'https://raw.githubusercontent.com/djgaiaffxiv-ctrl/nagi-brawl-cloud/main/data/';
const TAGS = ['9R8PPG822', 'P9U0GRYV8', '8VU0UGCCR'];
const PONDE = { me: '9R8PPG822', pollo: 'P9U0GRYV8', salmon: '8VU0UGCCR' };

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n ?? 0).toLocaleString('es-ES');
const cap = (s) => String(s || '').toLowerCase().replace(/(^|\s|-)\S/g, c => c.toUpperCase());
const pctWL = (w, l) => (w + l) ? Math.round(100 * w / (w + l)) : 0;
const pct = (w, p) => p ? (100 * w / p) : 0;
const wrClass = (v) => v >= 55 ? 'wr-hi' : v >= 47 ? 'wr-mid' : 'wr-lo';
const img = (id) => `https://cdn.brawlify.com/brawlers/borderless/${id}.png`;
const fb = `onerror="if(this.dataset.f){this.style.visibility='hidden'}else{this.dataset.f=1;this.src=this.src.replace('/borderless/','/emoji/')}"`;
const iconoPerfil = (id) => `https://cdn.brawlify.com/profile-icons/regular/${id}.png`;

const MODE_ES = {
  gemGrab: 'Atrapagemas', brawlBall: 'Balón Brawl', bounty: 'Caza estelar',
  heist: 'Atraco', hotZone: 'Zona restringida', knockout: 'Noqueo',
  soloShowdown: 'Supervivencia (solo)', duoShowdown: 'Supervivencia (dúo)',
  trioShowdown: 'Supervivencia (trío)', duels: 'Duelos', wipeout: 'Aniquilación',
  brawlBall5V5: 'Balón Brawl 5v5', basketBrawl: 'Basket Brawl', volleyBrawl: 'Voley Brawl',
  __ranked: '⚔ Competitivo'
};
const modo = (m) => MODE_ES[m] || (m ? m.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()) : '—');
const ROLE_ES = { president: 'Presidente', vicePresident: 'Vicepresidente', senior: 'Veterano', member: 'Miembro' };

function wilson(w, n) {
  if (!n) return 0;
  const z = 1.96, p = w / n;
  return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n);
}
function parseT(t) {
  if (!t || t.length < 15) return null;
  const d = new Date(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:${t.slice(13, 15)}.000Z`);
  return isNaN(d) ? null : d;
}
const dayKey = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
function dayLabel(d) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dia = new Date(d); dia.setHours(0, 0, 0, 0);
  const diff = Math.round((hoy - dia) / 864e5);
  if (diff === 0) return 'Hoy'; if (diff === 1) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
function classify(r) {
  if (r.result === 'victory') return { s: 'V', cls: 'win', lbl: 'VICTORIA', w: 1, l: 0 };
  if (r.result === 'defeat') return { s: 'D', cls: 'loss', lbl: 'DERROTA', w: 0, l: 1 };
  if (r.result === 'draw') return { s: 'E', cls: 'draw', lbl: 'EMPATE', w: 0, l: 0 };
  if (typeof r.rank === 'number') {
    const wr = { soloShowdown: 4, duoShowdown: 2, trioShowdown: 2 }[r.mode] || 4;
    const win = r.rank <= wr;
    return { s: '#' + r.rank, cls: win ? 'win' : 'loss', lbl: 'RANGO #' + r.rank, w: win ? 1 : 0, l: win ? 0 : 1 };
  }
  return { s: '·', cls: 'draw', lbl: '', w: 0, l: 0 };
}
function fmtConexion(t) {
  const mins = Math.floor((Date.now() - t.getTime()) / 60000);
  const hora = t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy.getTime() - 864e5);
  if (mins < 1) return { txt: 'jugando ahora', on: true };
  if (mins < 60) return { txt: `hace ${mins} min · ${hora}`, on: true };
  if (t >= hoy) return { txt: `hace ${Math.floor(mins / 60)} h · ${hora}`, on: false };
  if (t >= ayer) return { txt: `ayer · ${hora}`, on: false };
  return { txt: `${t.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${hora}`, on: false };
}

/* ---------------- datos ---------------- */
const D = { battles: {}, profile: {}, club: null, meta: null, vista: 'inicio', jug: TAGS[0], histN: 40, tierModo: 'all' };

async function traer(nombre, obligatorio) {
  try {
    const r = await fetch(RAW + nombre + '?cb=' + Date.now());
    if (!r.ok) throw new Error(nombre + ' ' + r.status);
    return await r.json();
  } catch (e) {
    if (obligatorio) throw e;
    return null;
  }
}

async function cargar() {
  $('#vista').innerHTML = '<div class="loading"><div class="spinner"></div>Cargando datos de la nube…</div>';
  const [battles, profile, club, meta] = await Promise.all([
    traer('battles.json', true), traer('profile.json', true), traer('club.json'), traer('meta.json')
  ]);
  D.battles = battles || {}; D.profile = profile || {}; D.club = club; D.meta = meta;
  const t = profile && profile[TAGS[0]] && profile[TAGS[0]].updated ? new Date(profile[TAGS[0]].updated) : new Date();
  $('#updated').textContent = 'nube: ' + t.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  pintar();
}

/* ---------------- vistas ---------------- */
function pintar() {
  const v = D.vista;
  if (v === 'inicio') vInicio();
  else if (v === 'jugadores') vJugadores();
  else if (v === 'ponde') vPonde();
  else if (v === 'tier') vTier();
  else if (v === 'club') vClub();
  window.scrollTo(0, 0);
}

function statsDe(tag) {
  const hist = D.battles[tag] || [];
  let w = 0, l = 0; const uso = {};
  for (const r of hist) {
    const c = classify(r); w += c.w; l += c.l;
    if (r.brawlerId != null) uso[r.brawlerId] = (uso[r.brawlerId] || 0) + 1;
  }
  const favs = Object.keys(uso).sort((a, b) => uso[b] - uso[a]).slice(0, 3);
  const ult = hist[0] ? parseT(hist[0].time) : null;
  return { hist, w, l, favs, ult };
}

function cardJugador(tag, extra) {
  const p = D.profile[tag] || {};
  const s = statsDe(tag);
  const cx = s.ult ? fmtConexion(s.ult) : null;
  const wr = pctWL(s.w, s.l);
  return `<div class="pcard ${extra || ''}" onclick="irJugador('${tag}')">
    <div class="p-top">
      <img src="${iconoPerfil(p.icon)}" onerror="this.style.visibility='hidden'">
      <div><div class="p-nombre">${esc(p.name || '#' + tag)}</div><div class="p-tag">#${tag}</div></div>
      <div class="p-tro"><b>🏆 ${fmt(p.trophies)}</b><span>réc ${fmt(p.highest)}</span></div>
    </div>
    <div class="wlbar">
      <b class="wr-hi">${wr}%</b>
      <div class="track"><i style="width:${wr}%"></i></div>
      <b class="wr-lo">${100 - wr}%</b>
      <div class="favs">${s.favs.map(id => `<img src="${img(+id)}" ${fb}>`).join('')}</div>
    </div>
    <div class="p-linea">
      ${cx ? `<span class="${cx.on ? 'on' : ''}">${cx.on ? '🟢 ' : '🕑 '}${cx.txt}</span>` : ''}
      <span>· ${fmt(s.hist.length)} partidas</span>
      ${p.ranked && p.ranked.name ? `<span class="chip" style="color:var(--nagi)">⚔ ${esc(p.ranked.name)}${p.ranked.elo ? ' · ' + fmt(p.ranked.elo) : ''}</span>` : ''}
    </div>
  </div>`;
}

window.irJugador = (tag) => { D.jug = tag; D.histN = 40; cambiarVista('jugadores'); };

function vInicio() {
  // MVP de hoy
  const hoy = dayKey(new Date());
  const filas = TAGS.map(tag => {
    const hist = D.battles[tag] || [];
    let w = 0, l = 0, net = 0, n = 0;
    for (const r of hist) {
      const d = parseT(r.time);
      if (!d || dayKey(d) !== hoy) continue;
      const c = classify(r); w += c.w; l += c.l; n++;
      if (typeof r.trophyChange === 'number') net += r.trophyChange;
    }
    return { tag, w, l, net, n };
  }).sort((a, b) => (b.net - a.net) || (pctWL(b.w, b.l) - pctWL(a.w, a.l)) || (b.n - a.n));
  const medallas = ['🥇', '🥈', '🥉'];
  const jugaron = filas.some(f => f.n > 0);

  $('#vista').innerHTML = `
    <div class="tit"><span class="dot oro"></span> Mis jugadores</div>
    <div class="fila-grid tres">${TAGS.map(t => cardJugador(t)).join('')}</div>

    <div class="tit"><span class="dot oro"></span> 👑 MVP de hoy · Ponde Team</div>
    <div class="card">
      ${jugaron ? filas.map((f, i) => {
        const p = D.profile[f.tag] || {};
        return `<div class="rowi" style="${i === 0 && f.n ? 'border-color:rgba(255,196,0,.5)' : ''}">
          <span class="medalla">${f.n ? medallas[i] : '—'}</span>
          <img src="${iconoPerfil(p.icon)}" onerror="this.style.visibility='hidden'">
          <span class="m">${esc(p.name || f.tag)}${i === 0 && f.n ? ' 👑' : ''}</span>
          ${f.n ? `<span class="sub">${f.n} partidas · ${f.w}V/${f.l}D</span>
          <b class="val ${f.net >= 0 ? 'wr-hi' : 'wr-lo'}">${f.net >= 0 ? '+' : ''}${f.net} 🏆</b>` : '<span class="sub">hoy no ha jugado</span>'}
        </div>`;
      }).join('') : '<div class="nota">Nadie ha jugado hoy todavía — ¡a por copas! 🏆</div>'}
    </div>
    ${brawlerDelDia()}`;
}

function brawlerDelDia() {
  if (!D.meta) return '';
  const top = Object.values(D.meta.brawlers).filter(r => r.picks >= 15)
    .sort((a, b) => wilson(b.wins, b.picks) - wilson(a.wins, a.picks)).slice(0, 20);
  if (!top.length) return '';
  const semilla = [...dayKey(new Date())].reduce((a, c) => a + c.charCodeAt(0), 0);
  const e = top[semilla % top.length];
  return `<div class="tit"><span class="dot"></span> 🌟 Brawler del día</div>
    <div class="rowi" style="border-color:rgba(255,196,0,.4)">
      <img src="${img(e.id)}" ${fb} style="width:38px;height:38px">
      <span class="m">${esc(cap(e.name))}</span>
      <b class="val wr-hi">${pct(e.wins, e.picks).toFixed(1)}% WR en el meta</b>
    </div>`;
}

/* ---- jugadores ---- */
function vJugadores() {
  const tag = D.jug;
  const p = D.profile[tag] || {};
  const s = statsDe(tag);
  const hist = s.hist;

  // némesis / víctimas
  const foes = {};
  for (const r of hist) {
    const w = classify(r); if (!w.lbl && w.s === '·') continue;
    const win = w.w === 1 ? 1 : (w.l === 1 ? 0 : null);
    if (win === null) continue;
    for (const e of (r.enemies || [])) {
      const n = (e.n || '').trim();
      if (!n || n === 'Brawler') continue;
      const f = foes[n] || (foes[n] = { n, g: 0, w: 0, l: 0, b: e.b });
      f.g++; if (win) f.w++; else f.l++;
    }
  }
  const arr = Object.values(foes).filter(f => f.g >= 3);
  const nemesis = arr.filter(f => f.l >= 2).sort((a, b) => (pctWL(a.w, a.l) - pctWL(b.w, b.l)) || (b.l - a.l)).slice(0, 5);
  const victimas = arr.filter(f => f.w >= 2).sort((a, b) => (pctWL(b.w, b.l) - pctWL(a.w, a.l)) || (b.w - a.w)).slice(0, 5);
  const filaFoe = (f) => `<div class="rowi">${f.b != null ? `<img src="${img(f.b)}" ${fb}>` : ''}
    <span class="m">${esc(f.n)}</span><span class="sub">${f.g} cruces · ${f.w}V/${f.l}D</span>
    <b class="val ${wrClass(pctWL(f.w, f.l))}">${pctWL(f.w, f.l)}%</b></div>`;

  // récords
  const crono = hist.slice().reverse();
  let racha = 0, mejorRacha = 0, mejorBotin = null; const dias = {};
  for (const r of crono) {
    const c = classify(r);
    if (c.w === 1) { racha++; if (racha > mejorRacha) mejorRacha = racha; } else if (c.l === 1) racha = 0;
    if (typeof r.trophyChange === 'number') {
      if (!mejorBotin || r.trophyChange > mejorBotin.trophyChange) mejorBotin = r;
      const d = parseT(r.time); if (d) { const k = dayKey(d); dias[k] = (dias[k] || 0) + r.trophyChange; }
    }
  }
  const diasArr = Object.entries(dias);
  const mejorDia = diasArr.length ? diasArr.reduce((a, b) => b[1] > a[1] ? b : a) : null;

  // historial paginado
  const visibles = hist.slice(0, D.histN);
  const grupos = []; const idx = {};
  for (const r of visibles) {
    const d = parseT(r.time); const k = d ? dayKey(d) : '?';
    if (idx[k] === undefined) { idx[k] = grupos.length; grupos.push({ d, items: [] }); }
    grupos[idx[k]].items.push(r);
  }
  const filaBatalla = (r) => {
    const c = classify(r); const t = parseT(r.time); const tc = r.trophyChange;
    const aliados = (r.mates || []).filter(m => m.t !== tag);
    const rivales = r.enemies || [];
    return `<div class="batalla ${c.cls}">
      <div class="b-top">
        ${r.brawlerId != null ? `<img src="${img(r.brawlerId)}" ${fb}>` : ''}
        <span class="b-res">${c.lbl}</span>
        <div class="b-mid"><div class="b-modo">${esc(modo(r.mode))}</div><div class="b-mapa">${esc(r.map || '')}</div></div>
        <span class="b-chg" style="color:${tc > 0 ? 'var(--verde)' : tc < 0 ? 'var(--rojo)' : 'var(--txt2)'}">${typeof tc === 'number' ? (tc > 0 ? '+' + tc : tc) : ''}</span>
        <div class="b-hora">${t ? `<b>${t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</b><small>${t.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</small>` : ''}</div>
      </div>
      ${aliados.length || rivales.length ? `<div class="b-equipos">
        ${aliados.map(m => `<span class="pl al">${m.b != null ? `<img src="${img(m.b)}" ${fb}>` : ''}${esc(m.n)}</span>`).join('')}
        ${aliados.length && rivales.length ? '<span class="vs">VS</span>' : ''}
        ${rivales.map(m => `<span class="pl en">${m.b != null ? `<img src="${img(m.b)}" ${fb}>` : ''}${esc(m.n)}</span>`).join('')}
      </div>` : ''}
    </div>`;
  };

  $('#vista').innerHTML = `
    <div class="sel-chips">${TAGS.map(t => `<button class="sel-chip ${t === tag ? 'act' : ''}" onclick="irJugador('${t}')">${esc((D.profile[t] || {}).name || t)}</button>`).join('')}</div>
    ${cardJugador(tag)}
    <div class="tit"><span class="dot"></span> Perfil</div>
    <div class="stats">
      <div class="st"><div class="k">Copas</div><div class="v" style="color:var(--oro)">${fmt(p.trophies)}</div></div>
      <div class="st"><div class="k">Récord</div><div class="v">${fmt(p.highest)}</div></div>
      ${p.ranked && p.ranked.name ? `<div class="st"><div class="k">⚔ Ranked</div><div class="v" style="font-size:11.5px">${esc(p.ranked.name)} · ${fmt(p.ranked.elo)}</div></div>` : ''}
      ${p.maxRanked && p.maxRanked.name ? `<div class="st"><div class="k">⚔ Máximo</div><div class="v" style="font-size:11.5px;color:var(--oro)">${esc(p.maxRanked.name)} · ${fmt(p.maxRanked.elo)}</div></div>` : ''}
      <div class="st"><div class="k">Brawlers</div><div class="v">${(p.brawlers || []).length}</div></div>
      <div class="st"><div class="k">Club</div><div class="v" style="font-size:11.5px">${esc(p.club || '—')}</div></div>
    </div>

    <div class="tit"><span class="dot oro"></span> 🏅 Récords del historial</div>
    <div class="stats">
      <div class="st"><div class="k">🔥 Mejor racha</div><div class="v wr-hi">${mejorRacha} victorias</div></div>
      ${mejorDia ? `<div class="st"><div class="k">📈 Mejor día</div><div class="v wr-hi">+${fmt(mejorDia[1])} 🏆</div></div>` : ''}
      ${mejorBotin ? `<div class="st"><div class="k">💰 Mayor botín</div><div class="v" style="color:var(--oro)">+${mejorBotin.trophyChange}</div></div>` : ''}
      <div class="st"><div class="k">📅 Días jugados</div><div class="v">${diasArr.length}</div></div>
    </div>

    <div class="fila-grid dos" style="margin-top:14px">
      <div>
        <div class="tit"><span class="dot"></span> 😈 Tus némesis</div>
        ${nemesis.map(filaFoe).join('') || '<div class="nota">Nadie te tose (mín. 3 cruces)</div>'}
      </div>
      <div>
        <div class="tit"><span class="dot oro"></span> 🎯 Tus víctimas</div>
        ${victimas.map(filaFoe).join('') || '<div class="nota">Aún sin víctimas frecuentes</div>'}
      </div>
    </div>

    <div class="tit"><span class="dot"></span> Historial <span class="extra">${fmt(hist.length)} partidas · WR ${pctWL(s.w, s.l)}%</span></div>
    ${grupos.map(g => {
      let dw = 0, dl = 0, ds = 0;
      const k = g.d ? dayKey(g.d) : '?';
      hist.forEach(r => { const d2 = parseT(r.time); if ((d2 ? dayKey(d2) : '?') !== k) return; const c = classify(r); dw += c.w; dl += c.l; if (typeof r.trophyChange === 'number') ds += r.trophyChange; });
      return `<div class="hist-dia"><span>${esc(g.d ? dayLabel(g.d) : '¿?')}</span>
        <span><b class="wr-hi">${dw}V</b> <b class="wr-lo">${dl}D</b> · <b class="${ds >= 0 ? 'wr-hi' : 'wr-lo'}">${ds >= 0 ? '+' : ''}${ds}🏆</b></span></div>` +
        g.items.map(filaBatalla).join('');
    }).join('')}
    ${hist.length > D.histN ? `<button class="btn-mas" onclick="masHistorial()">Mostrar más (${fmt(hist.length - D.histN)} restantes)</button>` : ''}`;
}
window.masHistorial = () => { D.histN += 80; vJugadores(); };

/* ---- ponde ---- */
function vPonde() {
  const battles = D.battles[PONDE.me] || [];
  const trio = battles.filter(r => {
    if (!r.mates || r.mates.length < 2) return false;
    const set = {}; r.mates.forEach(m => { set[m.t] = 1; });
    return set[PONDE.pollo] && set[PONDE.salmon];
  });
  if (!trio.length) {
    $('#vista').innerHTML = '<div class="nota" style="margin-top:40px">Aún no hay partidas en trío registradas.<br>¡Jugad juntos los 3 y aparecerán aquí!</div>';
    return;
  }
  let w = 0, l = 0, net = 0;
  trio.forEach(r => { const c = classify(r); w += c.w; l += c.l; if (typeof r.trophyChange === 'number') net += r.trophyChange; });
  const wr = pctWL(w, l);

  const comps = {};
  trio.forEach(r => {
    const set = new Set();
    if (r.brawlerId != null) set.add(r.brawlerId);
    (r.mates || []).forEach(m => { if (m.b != null) set.add(m.b); });
    const ids = [...set].sort((a, b) => a - b);
    if (ids.length !== 3) return;
    const k = ids.join('-');
    const c = comps[k] || (comps[k] = { ids, g: 0, w: 0, l: 0 });
    const cc = classify(r); c.g++; c.w += cc.w; c.l += cc.l;
  });
  const compArr = Object.values(comps).sort((a, b) => (pctWL(b.w, b.l) - pctWL(a.w, a.l)) || (b.g - a.g));

  const mapas = {};
  trio.forEach(r => { const m = r.map || '?'; const x = mapas[m] || (mapas[m] = { map: m, g: 0, w: 0, l: 0 }); const c = classify(r); x.g++; x.w += c.w; x.l += c.l; });
  const mapArr = Object.values(mapas).sort((a, b) => (pctWL(b.w, b.l) - pctWL(a.w, a.l)) || (b.g - a.g));

  const franjas = { 'Mañana (6-14h)': { w: 0, l: 0 }, 'Tarde (14-21h)': { w: 0, l: 0 }, 'Noche (21-6h)': { w: 0, l: 0 } };
  trio.forEach(r => {
    const d = parseT(r.time); if (!d) return;
    const h = d.getHours();
    const f = h >= 6 && h < 14 ? 'Mañana (6-14h)' : h >= 14 && h < 21 ? 'Tarde (14-21h)' : 'Noche (21-6h)';
    const c = classify(r); franjas[f].w += c.w; franjas[f].l += c.l;
  });
  const franjasArr = Object.entries(franjas).filter(([, x]) => x.w + x.l >= 3);
  const mejorF = franjasArr.length ? franjasArr.reduce((a, b) => pctWL(b[1].w, b[1].l) > pctWL(a[1].w, a[1].l) ? b : a) : null;

  $('#vista').innerHTML = `
    <div class="tit"><span class="dot oro"></span> 👑 Ponde Team</div>
    <div class="stats">
      <div class="st"><div class="k">Partidas en trío</div><div class="v">${fmt(trio.length)}</div></div>
      <div class="st"><div class="k">Victorias</div><div class="v ${wr >= 50 ? 'wr-hi' : 'wr-lo'}">${wr}%</div></div>
      <div class="st"><div class="k">Balance</div><div class="v">${w}V / ${l}D</div></div>
      <div class="st"><div class="k">Trofeos netos</div><div class="v ${net >= 0 ? 'wr-hi' : 'wr-lo'}">${net >= 0 ? '+' : ''}${fmt(net)}</div></div>
    </div>

    <div class="fila-grid dos" style="margin-top:14px">
      <div>
        <div class="tit"><span class="dot"></span> 🏆 Mejores composiciones</div>
        ${compArr.slice(0, 6).map(c => `<div class="comp">
          <div class="imgs">${c.ids.map(id => `<img src="${img(id)}" ${fb}>`).join('')}</div>
          <div class="nombres">${c.ids.length} brawlers</div>
          <div class="datos"><b class="${pctWL(c.w, c.l) >= 50 ? 'wr-hi' : 'wr-lo'}">${pctWL(c.w, c.l)}%</b><span>${c.g} part. · ${c.w}V/${c.l}D</span></div>
        </div>`).join('')}
      </div>
      <div>
        <div class="tit"><span class="dot"></span> 🗺 Mejores mapas</div>
        ${mapArr.slice(0, 6).map(m => `<div class="rowi"><span class="m">${esc(m.map)}</span>
          <span class="sub">${m.g} partidas</span><b class="val ${wrClass(pctWL(m.w, m.l))}">${pctWL(m.w, m.l)}%</b></div>`).join('')}
        ${mejorF ? `
        <div class="tit"><span class="dot oro"></span> 🕑 Vuestro mejor horario</div>
        ${franjasArr.map(([f, x]) => `<div class="rowi"><span class="m">${f === mejorF[0] ? '⭐ ' : ''}${esc(f)}</span>
          <span class="sub">${x.w + x.l} part.</span><b class="val ${wrClass(pctWL(x.w, x.l))}">${pctWL(x.w, x.l)}%</b></div>`).join('')}` : ''}
      </div>
    </div>

    <div class="tit"><span class="dot"></span> Últimas del trío</div>
    ${trio.slice(0, 15).map(r => {
      const c = classify(r); const t = parseT(r.time);
      return `<div class="batalla ${c.cls}"><div class="b-top">
        ${r.brawlerId != null ? `<img src="${img(r.brawlerId)}" ${fb}>` : ''}
        <span class="b-res">${c.lbl}</span>
        <div class="b-mid"><div class="b-modo">${esc(modo(r.mode))}</div><div class="b-mapa">${esc(r.map || '')}</div></div>
        <div class="b-hora">${t ? `<b>${t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</b><small>${t.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</small>` : ''}</div>
      </div></div>`;
    }).join('')}`;
}

/* ---- tier ---- */
function vTier() {
  if (!D.meta) {
    $('#vista').innerHTML = '<div class="nota" style="margin-top:40px">El meta aún no está publicado en la nube.<br>El robot lo calcula cada 6 horas — vuelve en un rato.</div>';
    return;
  }
  const meta = D.meta;
  const min = D.tierModo === 'all' ? 15 : 6;
  const lista = Object.values(meta.brawlers)
    .map(r => D.tierModo === 'all' ? r : (r.modes[D.tierModo] ? { id: r.id, name: r.name, picks: r.modes[D.tierModo].picks, wins: r.modes[D.tierModo].wins } : null))
    .filter(r => r && r.picks >= min)
    .sort((a, b) => wilson(b.wins, b.picks) - wilson(a.wins, a.picks));

  let prevMap = null;
  if (D.tierModo === 'all' && meta.prev) {
    const pl = Object.entries(meta.prev.brawlers).map(([id, v]) => ({ id, ...v }))
      .filter(r => r.picks >= 15).sort((a, b) => wilson(b.wins, b.picks) - wilson(a.wins, a.picks));
    prevMap = {}; pl.forEach((r, i) => { prevMap[r.id] = i; });
  }
  const mov = (id, pos) => {
    if (!prevMap) return '';
    const antes = prevMap[String(id)];
    if (antes === undefined) return '<span class="mov nuevo">NEW</span>';
    const d = antes - pos;
    if (d > 0) return `<span class="mov sube">▲${d}</span>`;
    if (d < 0) return `<span class="mov baja">▼${-d}</span>`;
    return '';
  };

  const TIERS = [
    { t: 'S', from: 0, to: .12, bg: 'linear-gradient(135deg,#ffd76a,#ffb400)' },
    { t: 'A', from: .12, to: .32, bg: 'linear-gradient(135deg,#8fe38f,#3ddc84)' },
    { t: 'B', from: .32, to: .56, bg: 'linear-gradient(135deg,#7cc3ff,#4da8ff)' },
    { t: 'C', from: .56, to: .80, bg: 'linear-gradient(135deg,#c9c9d9,#9a9ab0)' },
    { t: 'D', from: .80, to: 1, bg: 'linear-gradient(135deg,#ff8f78,#ff5233)' }
  ];
  const modos = [...new Set(Object.values(meta.brawlers).flatMap(r => Object.keys(r.modes)))].filter(m => m !== '__ranked').sort();

  // compos por mapa (del meta de los top 200)
  const mapasComps = Object.keys(meta.comps || {}).map(mk => {
    const [mo, ...resto] = mk.split('|');
    return { mk, mo, mapa: resto.join('|') };
  }).sort((a, b) => a.mapa.localeCompare(b.mapa));

  $('#vista').innerHTML = `
    <div class="tit"><span class="dot"></span> Tier list del meta
      <span class="extra">${fmt(meta.battles)} batallas · top ${meta.players} del mundo</span></div>
    <div class="sel-chips" style="margin-bottom:10px">
      <select class="selector" id="selModo">
        <option value="all">Todos los modos</option>
        <option value="__ranked" ${D.tierModo === '__ranked' ? 'selected' : ''}>⚔ Competitivo</option>
        ${modos.map(m => `<option value="${esc(m)}" ${D.tierModo === m ? 'selected' : ''}>${esc(modo(m))}</option>`).join('')}
      </select>
    </div>
    ${TIERS.map(tier => {
      const filas = lista.slice(Math.floor(lista.length * tier.from), Math.floor(lista.length * tier.to));
      return `<div class="tier-fila">
        <div class="tier-tag" style="background:${tier.bg}">${tier.t}</div>
        <div class="tier-celdas">${filas.map(r => `
          <div class="tcel">${mov(r.id, lista.indexOf(r))}
            <img src="${img(r.id)}" ${fb}>
            <span class="n">${esc(cap(r.name))}</span>
            <span class="w ${wrClass(pct(r.wins, r.picks))}">${pct(r.wins, r.picks).toFixed(0)}%</span>
          </div>`).join('') || '<span class="nota" style="margin:auto">—</span>'}
        </div></div>`;
    }).join('')}

    <div class="tit"><span class="dot oro"></span> 🏆 Compos por mapa <span class="extra">${mapasComps.length} mapas con datos</span></div>
    <div class="sel-chips"><select class="selector" id="selMapa">
      ${mapasComps.map(m => `<option value="${esc(m.mk)}">${esc(m.mapa)} · ${esc(modo(m.mo))}</option>`).join('')}
    </select></div>
    <div id="compsMapa"></div>`;

  $('#selModo').addEventListener('change', e => { D.tierModo = e.target.value; vTier(); });
  const pintaCompos = () => {
    const mk = $('#selMapa').value;
    const bucket = (meta.comps || {})[mk] || {};
    const arr = Object.values(bucket).sort((a, b) => (wilson(b.wins, b.picks) - wilson(a.wins, a.picks)) || (b.picks - a.picks)).slice(0, 6);
    $('#compsMapa').innerHTML = arr.map(c => `<div class="comp">
      <div class="imgs">${c.ids.map(id => `<img src="${img(id)}" ${fb}>`).join('')}</div>
      <div class="nombres">${c.ids.map(id => cap((meta.brawlers[String(id)] || {}).name || '')).join(' + ')}</div>
      <div class="datos"><b class="${wrClass(pct(c.wins, c.picks))}">${pct(c.wins, c.picks).toFixed(0)}%</b>
      <span>${c.picks} part. · ${Math.round(c.wins)}V/${Math.round(c.picks - c.wins)}D</span></div>
    </div>`).join('') || '<div class="nota">Sin composiciones en este mapa todavía</div>';
  };
  if (mapasComps.length) { $('#selMapa').addEventListener('change', pintaCompos); pintaCompos(); }
}

/* ---- club ---- */
function vClub() {
  const c = D.club;
  if (!c) { $('#vista').innerHTML = '<div class="nota" style="margin-top:40px">Datos del club no disponibles.</div>'; return; }
  const miembros = (c.members || []).slice().sort((a, b) => b.trophies - a.trophies);
  $('#vista').innerHTML = `
    <div class="tit"><span class="dot"></span> 🛡 ${esc(c.name)}
      <span class="extra">${miembros.length} miembros · ${fmt(c.trophies)} 🏆 · entrada ${fmt(c.requiredTrophies || 0)}</span></div>
    ${miembros.map((m, i) => {
      const tagN = String(m.tag || '').replace('#', '');
      const nuestro = TAGS.includes(tagN);
      return `<div class="miembro ${nuestro ? 'nuestro' : ''}">
        <span class="pos">${i + 1}</span>
        <img src="${iconoPerfil(m.icon && m.icon.id != null ? m.icon.id : m.icon)}" onerror="this.style.visibility='hidden'">
        <div class="nom"><b>${esc(m.name)}${nuestro ? ' ⭐' : ''}</b><span>${esc(ROLE_ES[m.role] || m.role || '')}</span></div>
        <span class="tro">${fmt(m.trophies)} 🏆</span>
      </div>`;
    }).join('')}`;
}

/* ---------------- navegación ---------------- */
function cambiarVista(v) {
  D.vista = v;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  pintar();
}
$$('.tab').forEach(t => t.addEventListener('click', () => cambiarVista(t.dataset.v)));
$('#btnRefresh').addEventListener('click', cargar);

cargar().catch(e => {
  $('#vista').innerHTML = `<div class="nota" style="margin-top:40px">No se pudo cargar la nube.<br>${esc(e.message || e)}</div>`;
});
setInterval(cargar, 5 * 60e3);   // refresco automático cada 5 min
