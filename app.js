'use strict';
/* BESTLX — tu centro de control: lectura, retos sociales, redes, Canvas.
   Todo se guarda en el teléfono (localStorage) y, si conectas tu Google Sheet
   en Ajustes, también se envía allá con Apps Script. Canvas llega del Sheet. */

const KEY = 'bestlx-v1';
const TABS = { lectura: 'Lectura', libros: 'Libros', social: 'Social', redes: 'Redes', pantalla: 'Tiempo en pantalla', canvas: 'Canvas' };
const NIVELES = ['Calentamiento', 'Conversación corta', 'Iniciar', 'Grupo', 'Fuera de la zona'];
const SITS = { conocer: 'Conocer a alguien', amigos: 'Amigos', profundas: 'Profundas', divertidas: 'Divertidas', entrevista: 'Entrevista' };
const DEF = {
  cfg: { url: '', token: '', meta: 10, apps: ['Instagram', 'TikTok', 'X'] },
  lectura: [], libros: [], social: [], redes: [], pantalla: [], canvas: [], queue: [], swap: { f: '', n: 0 }, canvasOn: false
};

let S = JSON.parse(JSON.stringify(DEF));
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* almacenamiento vacío o bloqueado */ }
S.cfg = Object.assign({}, DEF.cfg, S.cfg);
S.canvas = S.canvas || [];

const D = { frases: [], retos: {}, preguntas: {} };
const ui = { tab: 'hoy', sit: 'conocer', q: 0, form: '', rate: 0, sync: '', verHechas: false };

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = () => iso(new Date());
const fecha = s => new Date(s + 'T12:00:00');
const addDays = (s, n) => { const d = fecha(s); d.setDate(d.getDate() + n); return iso(d); };
const lunes = s => addDays(s, -((fecha(s).getDay() + 6) % 7));
const dayNum = s => Math.round(fecha(s).getTime() / 864e5);
const dayOfYear = s => dayNum(s) - dayNum(s.slice(0, 4) + '-01-01');
const num = v => Number(String(v == null ? '' : v).replace(',', '.')) || 0;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const corta = s => fecha(s).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sin espacio */ } };
const url = (action, extra) => `${S.cfg.url}?action=${action}&token=${encodeURIComponent(S.cfg.token)}${extra || ''}`;

function toast(t) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = t; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ---------- guardar y sincronizar ---------- */
function upsert(tab, keys, row) {
  const a = S[tab];
  const i = a.findIndex(r => keys.every(k => String(r[k]) === String(row[k])));
  if (i >= 0) { a[i] = Object.assign({}, a[i], row); row = a[i]; } else a.push(row);
  S.queue.push({ action: 'upsert', tab: TABS[tab], keys, row });
  save(); flush();
}
function append(tab, row) {
  S[tab].push(row);
  S.queue.push({ action: 'append', tab: TABS[tab], row });
  save(); flush();
}
let busy = false;
async function flush() {
  if (!S.cfg.url || busy) return;
  busy = true;
  try {
    while (S.queue.length) {
      // text/plain evita la consulta previa (preflight) que Apps Script no responde
      const r = await fetch(S.cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ token: S.cfg.token }, S.queue[0]))
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'error');
      S.queue.shift(); save();
    }
    ui.sync = '';
  } catch (e) {
    ui.sync = e.message === 'token' ? 'El token no coincide con el del Apps Script.' : 'Sin conexión con el Sheet; se reintentará.';
  }
  busy = false;
}
async function pull(manual) {
  if (!S.cfg.url) return;
  await flush();
  if (S.queue.length) { if (manual) { toast('No se pudo sincronizar'); render(); } return; }
  try {
    const r = await fetch(url('all'));
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'error');
    if (S.queue.length) return; // se anotó algo mientras llegaba la respuesta
    for (const k in TABS) if (Array.isArray(j.data[TABS[k]])) S[k] = j.data[TABS[k]];
    S.canvasOn = !!j.data._canvas;
    ui.sync = ''; save(); render();
    if (manual) toast('Sincronizado');
  } catch (e) {
    ui.sync = e.message === 'token' ? 'El token no coincide con el del Apps Script.' : 'No se pudo leer el Sheet.';
    if (manual) { toast('No se pudo sincronizar'); render(); }
  }
}
async function syncCanvas() {
  if (!S.cfg.url) return toast('Primero conecta el Sheet en Ajustes');
  toast('Leyendo Canvas…');
  try {
    const r = await fetch(url('canvas_sync'));
    const j = await r.json();
    if (!j.ok) throw new Error(j.detalle || j.error);
    await pull();
    toast(`Canvas: ${j.n} entregas`);
  } catch (e) {
    toast(/CANVAS_URL|CANVAS_TOKEN/.test(e.message) ? 'Falta configurar Canvas en el script' : 'Canvas no respondió');
  }
}

/* ---------- cálculos ---------- */
function fraseHoy() { return D.frases.length ? D.frases[dayOfYear(hoy()) % D.frases.length] : null; }
function nivel() {
  for (let l = 1; l <= 5; l++) {
    const c = S.social.filter(r => num(r.Nivel) === l && r.Hecho === 'sí').length;
    if (c < 5 || l === 5) return { l, c: Math.min(c, 5) };
  }
}
function retoHoy() {
  const f = hoy();
  const reg = S.social.find(r => r.Fecha === f);
  if (reg) return { reg, texto: reg.Reto, l: num(reg.Nivel) };
  const l = nivel().l;
  const hechos = new Set(S.social.filter(r => r.Hecho === 'sí').map(r => r.Reto));
  let pool = (D.retos[l] || []).filter(t => !hechos.has(t));
  if (!pool.length) pool = D.retos[l] || [];
  const n = S.swap.f === f ? S.swap.n : 0;
  return { texto: pool.length ? pool[(dayNum(f) + n) % pool.length] : '', l };
}
function racha(fechas) {
  const set = new Set(fechas);
  let d = hoy(), n = 0;
  if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
const rachaLectura = () => racha(S.lectura.filter(r => num(r['Páginas']) > 0).map(r => r.Fecha));
const rachaSocial = () => racha(S.social.filter(r => r.Hecho === 'sí').map(r => r.Fecha));
const libroActual = () => [...S.libros].reverse().find(b => !b.Fin);
const paginasDe = libro => S.lectura.filter(r => r.Libro === libro).reduce((t, r) => t + num(r['Páginas']), 0);
const paginasDia = f => S.lectura.filter(r => r.Fecha === f).reduce((t, r) => t + num(r['Páginas']), 0);
const aperturas = (f, app) => S.redes.filter(r => String(r['Fecha y hora']).slice(0, 10) === f && (!app || r.App === app)).length;
function semana(ini) {
  const dias = Array.from({ length: 7 }, (_, i) => addDays(ini, i));
  return {
    paginas: dias.reduce((t, f) => t + paginasDia(f), 0),
    dias: dias.filter(f => paginasDia(f) > 0).length,
    retos: S.social.filter(r => dias.includes(r.Fecha) && r.Hecho === 'sí').length,
    redes: dias.reduce((t, f) => t + aperturas(f), 0)
  };
}
/* Canvas: filas del Sheet con fecha parseada y horas restantes */
function tareas() {
  const now = Date.now();
  return S.canvas.map(r => {
    const d = new Date(String(r.Vence).replace(' ', 'T'));
    return Object.assign({}, r, { d, h: (d - now) / 36e5, done: r.Entregado === 'sí' });
  }).filter(r => !isNaN(r.d)).sort((a, b) => a.d - b.d);
}
const pendientes = () => tareas().filter(r => !r.done && r.h > -24 * 7);
function cuando(r) {
  if (r.h <= 0) return 'vencida';
  if (r.h <= 24) return `hoy ${pad(r.d.getHours())}:${pad(r.d.getMinutes())}`;
  if (r.h <= 48) return `mañana ${pad(r.d.getHours())}:${pad(r.d.getMinutes())}`;
  return `${r.d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} · en ${Math.ceil(r.h / 24)} días`;
}
function actualizadoCanvas() {
  const u = S.canvas.map(r => String(r.Actualizado || '')).sort().pop();
  if (!u) return '';
  const min = Math.round((Date.now() - new Date(u.replace(' ', 'T'))) / 6e4);
  return min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `el ${u.slice(0, 10)}`;
}

/* ---------- piezas de pantalla ---------- */
const rule = () => '<div class="rule" aria-hidden="true"></div>';
const header = (t, sub) => `<header>${sub ? `<p class="fecha">${sub}</p>` : ''}<h1>${t}</h1>${rule()}</header>`;

function tareaItem(r) {
  const vencida = r.h <= 0 && !r.done;
  return `<li class="tarea ${vencida ? 'vencida' : ''}">
    <div class="row between"><span class="materia">${esc(r.Materia)}</span><span class="prio ${esc(r.Prioridad).toLowerCase()}">${esc(r.Prioridad)}</span></div>
    <a class="titulo" href="${esc(r.Link)}" target="_blank" rel="noopener">${esc(r['Título'])}</a>
    <small>${r.Tipo === 'prueba' ? 'Prueba' : 'Tarea'} · ${cuando(r)} · ${num(r.Peso)}% de la nota${num(r.Puntos) ? ` · ${num(r.Puntos)} pts` : ''}${r.done ? ' · entregada' : ''}</small></li>`;
}
function clasesCard() {
  const p = pendientes();
  if (!S.cfg.url) return '';
  if (!p.length) return `<section class="card"><h2>Clases</h2><p class="muted">${S.canvas.length ? 'Nada pendiente en Canvas. Aprovecha para leer.' : 'Canvas todavía no está conectado. Sigue el README y toca Sincronizar en Clases.'}</p></section>`;
  const alta = p.filter(r => r.Prioridad === 'Alta').length;
  return `<section class="card"><div class="row between"><h2>Clases</h2><span class="tag ${alta ? 'on' : ''}">${p.length} pendientes${alta ? ` · ${alta} alta` : ''}</span></div>
    <ul class="list">${p.slice(0, 3).map(tareaItem).join('')}</ul>
    ${p.length > 3 ? `<button class="sm ghost" data-a="tab" data-v="clases" style="margin-top:10px">Ver las ${p.length}</button>` : ''}</section>`;
}
function retoCard() {
  const r = retoHoy();
  let body;
  if (ui.form === 'reto') {
    body = `<label>¿Cómo te fue?</label>
      <div class="rate">${[1, 2, 3, 4, 5].map(n => `<button data-a="rate" data-v="${n}" class="${ui.rate === n ? 'on' : ''}" aria-label="${n} de 5">${n}</button>`).join('')}</div>
      <label for="nota">Nota (opcional)</label>
      <textarea id="nota" placeholder="¿Qué pasó? ¿Qué harías distinto?">${esc(r.reg ? r.reg.Nota : '')}</textarea>
      <div class="row" style="margin-top:10px"><button class="pri grow" data-a="reto-guardar">Guardar</button><button class="ghost" data-a="cancelar">Cancelar</button></div>`;
  } else if (r.reg) {
    const si = r.reg.Hecho === 'sí';
    body = `<p class="${si ? 'ok' : 'muted'}">${si ? '✓ Hecho' + (num(r.reg['Cómo te fue']) ? ` · te fue ${num(r.reg['Cómo te fue'])}/5` : '') : 'Hoy no lo hiciste. Mañana hay otro.'}</p>
      ${r.reg.Nota ? `<p class="muted">${esc(r.reg.Nota)}</p>` : ''}
      <button class="sm" data-a="reto-si">${si ? 'Editar' : 'Sí lo hice'}</button>`;
  } else {
    body = `<div class="row"><button class="pri grow" data-a="reto-si">Lo hice</button><button data-a="reto-no">Hoy no</button><button class="ghost" data-a="reto-otro">Cambiar</button></div>`;
  }
  return `<section class="card"><div class="row between"><h2>Reto de hoy</h2><span class="tag">Nivel ${r.l} · ${NIVELES[r.l - 1]}</span></div>
    <p class="big">${esc(r.texto) || 'Cargando retos…'}</p>${body}</section>`;
}
function libroForm() {
  return `<label for="l-t">Título</label><input id="l-t" autocomplete="off">
    <label for="l-a">Autor</label><input id="l-a" autocomplete="off">
    <label for="l-p">Páginas totales</label><input id="l-p" type="number" inputmode="numeric" min="1">
    <div class="row" style="margin-top:12px"><button class="pri grow" data-a="libro-guardar">Empezar este libro</button>${libroActual() ? '<button class="ghost" data-a="cancelar">Cancelar</button>' : ''}</div>`;
}
function lecturaCard() {
  const b = libroActual();
  if (!b || ui.form === 'libro') return `<section class="card"><h2>${b ? 'Cambiar de libro' : 'Lectura'}</h2>${b ? '' : '<p class="muted">Agrega el libro que estás leyendo para empezar tu racha.</p>'}${libroForm()}</section>`;
  const f = hoy(), reg = S.lectura.find(r => r.Fecha === f && r.Libro === b.Libro);
  const hechas = reg ? num(reg['Páginas']) : 0, meta = num(S.cfg.meta) || 10;
  const leidas = paginasDe(b.Libro), total = num(b['Páginas totales']);
  return `<section class="card"><div class="row between"><h2>Lectura</h2><span class="tag ${hechas >= meta ? 'on' : ''}">${hechas}/${meta} págs hoy</span></div>
    <p class="big" style="margin-bottom:2px">${esc(b.Libro)}</p>
    <p class="muted">${esc(b.Autor || '')}${total ? ` · ${Math.min(leidas, total)} de ${total} páginas` : ` · ${leidas} páginas`}</p>
    ${total ? `<div class="bar"><i style="width:${Math.min(100, Math.round(leidas / total * 100))}%"></i></div>` : ''}
    <label for="pags">Páginas leídas hoy</label>
    <div class="row"><input id="pags" class="num" type="number" inputmode="numeric" min="0" value="${hechas || ''}" placeholder="0"><button class="pri grow" data-a="leer-guardar">Guardar</button></div></section>`;
}
function redesCard() {
  const f = hoy();
  return `<section class="card"><div class="row between"><h2>Redes hoy</h2><span class="tag">${aperturas(f)} aperturas</span></div>
    ${S.cfg.apps.map(a => `<div class="app"><span>${esc(a)}</span><span><b>${aperturas(f, a)}</b><button class="sm" data-a="abrir" data-v="${esc(a)}" aria-label="Sumar una apertura de ${esc(a)}">+1</button></span></div>`).join('')}
    <p class="muted" style="margin:10px 0 0">${S.cfg.url ? 'El Atajo del iPhone las anota solo; usa +1 si se le escapó alguna.' : 'Toca +1 cada vez que abras una. Con el Sheet conectado, el Atajo lo hace solo.'}</p></section>`;
}
function preguntasCard() {
  const lista = D.preguntas[ui.sit] || [];
  return `<section class="card"><h2>Preguntas para conversar</h2>
    <div class="chips">${Object.keys(SITS).map(k => `<button data-a="sit" data-v="${k}" class="${ui.sit === k ? 'on' : ''}">${SITS[k]}</button>`).join('')}</div>
    <div class="pregunta">${esc(lista[ui.q % (lista.length || 1)] || '…')}</div>
    <button class="pri" style="width:100%;margin-top:14px" data-a="otra">Otra pregunta</button></section>`;
}
function avisoPantalla() {
  const sem = lunes(hoy());
  if (fecha(hoy()).getDay() !== 0 || S.pantalla.some(r => r.Semana === sem)) return '';
  return `<section class="card warn"><p><strong>Es domingo:</strong> anota las horas de Tiempo en pantalla de esta semana.</p><button class="sm" data-a="tab" data-v="progreso">Anotar ahora</button></section>`;
}
const HERO = `<svg class="hero" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs><radialGradient id="g" cx="62%" cy="40%" r="60%"><stop offset="0" stop-color="#f6dc8c"/><stop offset=".35" stop-color="#c9962c"/><stop offset="1" stop-color="#060504"/></radialGradient></defs>
  <rect width="400" height="150" fill="url(#g)"/>
  <circle cx="250" cy="60" r="26" fill="#f9e7a8" opacity=".9"/>
  <path d="M0 150V112c30-8 52-28 80-30s46 18 72 14 40-26 68-24 44 22 72 18 50-26 108-22v82z" fill="#1a1409"/>
  <path d="M0 150v-26c28-4 50-22 76-22s44 16 70 12 42-20 70-18 44 18 72 14 56-22 112-18v58z" fill="#0d0a05"/>
  <path d="M0 150v-10c40-2 70-16 104-16s52 12 84 10 44-16 76-14 50 14 80 12 40-10 56-8v26z" fill="#060504"/>
  <g fill="#060504"><path d="M196 116c0-3 1.6-5 4-5s4 2 4 5-1.6 5-4 5-4-2-4-5zm-3 6h14l2 13-3 1-2-9v16h-3v-11h-2v11h-3v-16l-2 9-3-1z"/></g>
  <g fill="none" stroke="#0d0a05" stroke-width="1.4" stroke-linecap="round"><path d="M300 42q4-4 8 0M306 48q4-4 8 0M330 36q4-4 8 0"/></g>
</svg>`;

/* ---------- pantallas ---------- */
const V = {
  hoy() {
    const f = fraseHoy();
    return `${HERO}${header('BEST<b>LX</b>', new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))}
      <section class="card frase"><h2>Frase del día</h2><blockquote lang="${f ? f.l : 'es'}">${f ? esc(f.t) : '…'}</blockquote>${f ? `<span class="tag">${esc(f.tema)}</span>` : ''}</section>
      ${avisoPantalla()}${clasesCard()}${retoCard()}${lecturaCard()}${redesCard()}`;
  },
  clases() {
    const todas = tareas(), p = pendientes();
    const lista = ui.verHechas ? todas : p;
    const grupos = [['Vencidas', r => r.h <= 0 && !r.done], ['Hoy y mañana', r => r.h > 0 && r.h <= 48], ['Esta semana', r => r.h > 48 && r.h <= 24 * 7], ['Después', r => r.h > 24 * 7], ['Entregadas', r => r.done && r.h <= 0]];
    const alta = p.filter(r => r.Prioridad === 'Alta').length;
    const pesoSemana = p.filter(r => r.h <= 24 * 7).reduce((t, r) => t + num(r.Peso), 0);
    let cuerpo;
    if (!S.cfg.url) cuerpo = `<section class="card"><p class="muted">Conecta primero tu Sheet en <b>Progreso › Ajustes</b>. Canvas llega por ahí.</p></section>`;
    else if (!S.canvas.length) cuerpo = `<section class="card"><p class="muted">Todavía no hay datos de Canvas. Pon <code>CANVAS_URL</code> y <code>CANVAS_TOKEN</code> en las Propiedades del script (README, paso 6) y toca Sincronizar.</p></section>`;
    else cuerpo = grupos.map(([t, fn]) => { const g = lista.filter(fn); return g.length ? `<section class="card"><h2>${t}</h2><ul class="list">${g.map(tareaItem).join('')}</ul></section>` : ''; }).join('') || `<section class="card"><p class="muted">Nada pendiente. Buen momento para leer.</p></section>`;
    return `${header('Clases', S.canvas.length ? `Canvas · actualizado ${actualizadoCanvas()}` : 'Canvas')}
      <div class="tiles"><div class="tile"><b>${p.length}</b><span>pendientes</span></div><div class="tile"><b>${alta}</b><span>prioridad alta</span></div><div class="tile"><b>${Math.round(pesoSemana)}%</b><span>de nota esta semana</span></div></div>
      <div class="row" style="margin-bottom:14px"><button class="grow" data-a="canvas-sync">Sincronizar</button><button class="ghost" data-a="ver-hechas">${ui.verHechas ? 'Ocultar entregadas' : 'Ver entregadas'}</button></div>
      ${cuerpo}`;
  },
  lectura() {
    const b = libroActual();
    const hist = [...S.lectura].sort((a, c) => c.Fecha.localeCompare(a.Fecha)).slice(0, 10);
    const fin = S.libros.filter(x => x.Fin).reverse();
    return `${header('Lectura')}
      <div class="tiles"><div class="tile"><b>${rachaLectura()}</b><span>días de racha</span></div><div class="tile"><b>${semana(lunes(hoy())).paginas}</b><span>págs esta semana</span></div><div class="tile"><b>${fin.length}</b><span>libros terminados</span></div></div>
      ${lecturaCard()}
      ${b && ui.form !== 'libro' ? `<div class="row" style="margin-bottom:14px"><button class="grow" data-a="libro-fin">Terminé este libro</button><button class="grow" data-a="libro-cambiar">Cambiar de libro</button></div>` : ''}
      ${hist.length ? `<section class="card"><h2>Últimos días</h2><ul class="list">${hist.map(r => `<li>${num(r['Páginas'])} páginas<small>${corta(r.Fecha)} · ${esc(r.Libro)}</small></li>`).join('')}</ul></section>` : ''}
      ${fin.length ? `<section class="card"><h2>Terminados</h2><ul class="list">${fin.map(x => `<li>${esc(x.Libro)}<small>${esc(x.Autor || '')} · ${esc(x.Inicio)} a ${esc(x.Fin)}</small></li>`).join('')}</ul></section>` : ''}`;
  },
  social() {
    const n = nivel();
    const hist = [...S.social].sort((a, c) => c.Fecha.localeCompare(a.Fecha)).slice(0, 15);
    return `${header('Social')}
      <section class="card"><div class="row between"><h2>Tu nivel</h2><span class="tag on">Nivel ${n.l} de 5</span></div>
        <p class="big" style="margin-bottom:4px">${NIVELES[n.l - 1]}</p>
        <div class="dots">${[0, 1, 2, 3, 4].map(i => `<i class="${i < n.c ? 'on' : ''}"></i>`).join('')}</div>
        <p class="muted" style="margin:8px 0 0">${n.l === 5 && n.c >= 5 ? 'Completaste todos los niveles. Sigue con los retos del nivel 5.' : `${n.c} de 5 retos para subir de nivel`}</p></section>
      ${retoCard()}${preguntasCard()}
      ${hist.length ? `<section class="card"><h2>Historial</h2><ul class="list">${hist.map(r => `<li>${r.Hecho === 'sí' ? '✓' : '–'} ${esc(r.Reto)}<small>${corta(r.Fecha)} · nivel ${num(r.Nivel)}${num(r['Cómo te fue']) ? ` · ${num(r['Cómo te fue'])}/5` : ''}${r.Nota ? ' · ' + esc(r.Nota) : ''}</small></li>`).join('')}</ul></section>` : ''}`;
  },
  progreso() {
    const ini = lunes(hoy()), a = semana(ini), p = semana(addDays(ini, -7));
    const fila = (t, x, y, menosEsMejor) => {
      const d = x - y, bien = menosEsMejor ? d < 0 : d > 0;
      return `<tr><td>${t}</td><td>${y}</td><td>${x}</td><td class="${d === 0 ? '' : bien ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</td></tr>`;
    };
    const reg = S.pantalla.find(r => r.Semana === ini);
    const ult = [...S.pantalla].sort((x, y) => y.Semana.localeCompare(x.Semana)).slice(0, 5);
    const entregadasSem = tareas().filter(r => r.done && r.Vence >= ini).length;
    return `${header('Progreso')}
      <div class="tiles"><div class="tile"><b>${rachaLectura()}</b><span>racha lectura</span></div><div class="tile"><b>${rachaSocial()}</b><span>racha social</span></div><div class="tile"><b>${nivel().l}</b><span>nivel social</span></div></div>
      <section class="card"><h2>Esta semana contra la anterior</h2><table><tr><th></th><th>Anterior</th><th>Esta</th><th>Cambio</th></tr>
        ${fila('Páginas leídas', a.paginas, p.paginas)}${fila('Días con lectura', a.dias, p.dias)}${fila('Retos hechos', a.retos, p.retos)}${fila('Aperturas de redes', a.redes, p.redes, true)}</table>
        ${S.canvas.length ? `<p class="muted" style="margin:10px 0 0">Entregas de Canvas hechas esta semana: ${entregadasSem}</p>` : ''}</section>
      <section class="card"><h2>Tiempo en pantalla</h2><p class="muted">Una vez por semana, copia lo que marca Ajustes &gt; Tiempo en pantalla. Semana del ${corta(ini)}.</p>
        <div class="row"><div class="grow"><label for="h-t">Horas totales</label><input id="h-t" type="number" inputmode="decimal" step="0.5" min="0" value="${reg ? esc(reg['Horas totales']) : ''}"></div>
        <div class="grow"><label for="h-r">Horas en redes</label><input id="h-r" type="number" inputmode="decimal" step="0.5" min="0" value="${reg ? esc(reg['Horas en redes']) : ''}"></div></div>
        <button class="pri" style="width:100%;margin-top:12px" data-a="pantalla-guardar">Guardar semana</button>
        ${ult.length ? `<ul class="list" style="margin-top:12px">${ult.map(r => `<li>${num(r['Horas en redes'])} h en redes de ${num(r['Horas totales'])} h<small>semana del ${corta(r.Semana)}</small></li>`).join('')}</ul>` : ''}</section>
      <section class="card"><details ${S.cfg.url ? '' : 'open'}><summary>Ajustes y Google Sheet</summary>
        <p class="muted" style="margin-top:10px">${S.cfg.url ? (ui.sync || (S.queue.length ? `${S.queue.length} registros esperando envío.` : 'Conectado. Todo está guardado en tu Sheet.')) : 'Sin Sheet conectado: por ahora los datos viven solo en este teléfono. Sigue el README para conectarlo.'}</p>
        ${S.cfg.url ? `<p class="muted">Canvas: ${S.canvasOn ? (S.canvas.length ? `${S.canvas.length} entregas, actualizado ${actualizadoCanvas()}` : 'configurado, sin datos aún') : 'sin configurar en el script'}.</p>` : ''}
        <label for="c-u">URL de la app web de Apps Script</label><input id="c-u" type="url" inputmode="url" autocapitalize="off" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.cfg.url)}">
        <label for="c-k">Token (el mismo que pusiste en Code.gs)</label><input id="c-k" autocapitalize="off" autocomplete="off" value="${esc(S.cfg.token)}">
        <label for="c-m">Meta diaria de páginas</label><input id="c-m" type="number" inputmode="numeric" min="1" value="${num(S.cfg.meta) || 10}">
        <label for="c-a">Redes que cuentas (separadas por coma)</label><input id="c-a" autocomplete="off" value="${esc(S.cfg.apps.join(', '))}">
        <div class="row" style="margin-top:12px"><button class="pri grow" data-a="cfg-guardar">Guardar ajustes</button>${S.cfg.url ? '<button data-a="sync">Sincronizar</button>' : ''}</div></details></section>`;
  }
};

const ICON = {
  hoy: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  clases: '<path d="M2 9.5 12 5l10 4.5L12 14z"/><path d="M6 11.5v4.5c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9.5V15"/>',
  lectura: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13v2H6"/>',
  social: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  progreso: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
};
const NOMBRES = { hoy: 'Hoy', clases: 'Clases', lectura: 'Lectura', social: 'Social', progreso: 'Progreso' };

function render() {
  $('#view').innerHTML = V[ui.tab]();
  $('#tabs').innerHTML = Object.keys(V).map(k => `<button data-a="tab" data-v="${k}" class="${ui.tab === k ? 'on' : ''}" ${ui.tab === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>${NOMBRES[k]}</button>`).join('');
}

/* ---------- acciones ---------- */
const A = {
  tab(v) { ui.tab = v; ui.form = ''; window.scrollTo(0, 0); },
  cancelar() { ui.form = ''; },
  rate(v) { ui.rate = Number(v); },
  'reto-si'() { const r = retoHoy(); ui.form = 'reto'; ui.rate = r.reg ? num(r.reg['Cómo te fue']) : 0; },
  'reto-no'() { const r = retoHoy(); upsert('social', ['Fecha'], { Fecha: hoy(), Nivel: r.l, Reto: r.texto, Hecho: 'no', 'Cómo te fue': '', Nota: '' }); },
  'reto-otro'() { const f = hoy(); S.swap = { f, n: (S.swap.f === f ? S.swap.n : 0) + 1 }; save(); },
  'reto-guardar'() {
    const antes = nivel().l, r = retoHoy();
    upsert('social', ['Fecha'], { Fecha: hoy(), Nivel: r.l, Reto: r.texto, Hecho: 'sí', 'Cómo te fue': ui.rate || '', Nota: $('#nota').value.trim() });
    ui.form = '';
    toast(nivel().l > antes ? `¡Subiste al nivel ${nivel().l}!` : 'Reto guardado');
  },
  'leer-guardar'() {
    const b = libroActual(), p = Math.max(0, Math.round(num($('#pags').value)));
    upsert('lectura', ['Fecha', 'Libro'], { Fecha: hoy(), Libro: b.Libro, 'Páginas': p, Minutos: '' });
    toast(p >= (num(S.cfg.meta) || 10) ? 'Meta de hoy cumplida' : 'Lectura guardada');
  },
  'libro-cambiar'() { ui.form = 'libro'; },
  'libro-fin'() {
    const b = libroActual();
    if (!confirm(`¿Marcar "${b.Libro}" como terminado?`)) return;
    upsert('libros', ['Libro', 'Inicio'], Object.assign({}, b, { Fin: hoy() }));
    toast('Libro terminado');
  },
  'libro-guardar'() {
    const t = $('#l-t').value.trim();
    if (!t) return toast('Escribe el título');
    const b = libroActual();
    if (b) upsert('libros', ['Libro', 'Inicio'], Object.assign({}, b, { Fin: hoy() }));
    upsert('libros', ['Libro', 'Inicio'], { Libro: t, Autor: $('#l-a').value.trim(), Inicio: hoy(), Fin: '', 'Páginas totales': Math.round(num($('#l-p').value)) || '' });
    ui.form = '';
  },
  abrir(v) { const d = new Date(); append('redes', { 'Fecha y hora': `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, App: v }); },
  sit(v) { ui.sit = v; ui.q = Math.floor(Math.random() * 40); },
  otra() { ui.q++; },
  'ver-hechas'() { ui.verHechas = !ui.verHechas; },
  'canvas-sync'() { syncCanvas(); },
  'pantalla-guardar'() {
    const t = $('#h-t').value, r = $('#h-r').value;
    if (t === '' || r === '') return toast('Completa las dos casillas');
    upsert('pantalla', ['Semana'], { Semana: lunes(hoy()), 'Horas totales': num(t), 'Horas en redes': num(r) });
    toast('Semana guardada');
  },
  'cfg-guardar'() {
    S.cfg.url = $('#c-u').value.trim();
    S.cfg.token = $('#c-k').value.trim();
    S.cfg.meta = Math.max(1, Math.round(num($('#c-m').value)) || 10);
    const apps = $('#c-a').value.split(',').map(x => x.trim()).filter(Boolean);
    if (apps.length) S.cfg.apps = apps;
    save(); toast('Ajustes guardados');
    if (S.cfg.url) pull(true);
  },
  sync() { pull(true); }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b || !A[b.dataset.a]) return;
  A[b.dataset.a](b.dataset.v);
  render();
});

/* ---------- arranque ---------- */
async function cargar() {
  try {
    const [f, r, p] = await Promise.all(['frases', 'retos', 'preguntas'].map(n => fetch(`./data/${n}.json`).then(x => x.json())));
    const temas = Object.keys(f), largo = Math.max(...temas.map(t => f[t].es.length));
    // Alterna idioma y tema para que no salgan dos días seguidos iguales
    for (let i = 0; i < largo; i++) for (let pasada = 0; pasada < 2; pasada++) temas.forEach((t, ti) => {
      const l = (ti + pasada) % 2 === 0 ? 'es' : 'en';
      if (f[t][l][i]) D.frases.push({ t: f[t][l][i], tema: t, l });
    });
    D.retos = r; D.preguntas = p;
  } catch (e) { toast('No se pudo cargar el contenido'); }
  ui.q = Math.floor(Math.random() * 40);
  render();
}
render();
cargar();
pull();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); pull(); } });
window.addEventListener('online', flush);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
