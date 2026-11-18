'use strict';
/* BESTLX v3 — centro de control personal.
   Datos en el teléfono (localStorage) + copia en Google Sheet vía Apps Script.
   Pestañas: Hoy · Clases · Misiones · Diario · Progreso. */

const KEY = 'bestlx-v1';
const TABS = {
  lectura: 'Lectura', libros: 'Libros', social: 'Social', redes: 'Redes', pantalla: 'Tiempo en pantalla', canvas: 'Canvas',
  xp: 'XP', notas: 'Notas', agua: 'Agua', salud: 'Salud', enfoque: 'Enfoque', repaso: 'Repaso', personas: 'Personas', tienda: 'Tienda', canjes: 'Canjes'
};
const NIVELES = ['Calentamiento', 'Conversación corta', 'Iniciar', 'Grupo', 'Fuera de la zona'];
const SITS = { conocer: 'Conocer a alguien', amigos: 'Amigos', profundas: 'Profundas', divertidas: 'Divertidas', entrevista: 'Entrevista' };
const ATTR = ['Fuerza', 'Mente', 'Carisma', 'Disciplina', 'Enfoque'];
const ATTR_COLOR = { Fuerza: 'var(--c-cuerpo)', Mente: 'var(--c-mis)', Carisma: 'var(--c-social)', Disciplina: 'var(--c-lectura)', Enfoque: 'var(--c-enfoque)' };
const RANGOS = [
  { n: 'Iniciado', xp: 0 }, { n: 'Hoplita', xp: 300 }, { n: 'Espartano', xp: 1000 },
  { n: 'Campeón', xp: 2500 }, { n: 'Semidiós', xp: 5000 }, { n: 'GOD', xp: 10000 }
];
const TEMPORADAS = { 1: 'Mente', 2: 'Fuerza', 3: 'Carisma', 4: 'Enfoque', 5: 'Disciplina', 6: 'Mente', 7: 'Mente', 8: 'Fuerza', 9: 'Carisma', 10: 'Enfoque', 11: 'Mente', 12: 'Mente' };
const TEMP_NOMBRE = { Mente: 'Temporada de exámenes', Fuerza: 'Temporada del cuerpo', Carisma: 'Temporada de la palabra', Enfoque: 'Temporada sin scroll', Disciplina: 'Temporada de la constancia' };
const JEFES = ['La Hidra del Scroll', 'El Cíclope de la Pereza', 'Las Sirenas de TikTok', 'El Minotauro del Desorden', 'Medusa de la Distracción', 'El Coloso de la Procrastinación', 'Cerbero del Desvelo'];
const LUGARES = { casa: 'Casa', u: 'U', bus: 'Bus', calle: 'Calle' };
const ZONA = { hoy: 'hoy', clases: 'clases', misiones: 'mis', lectura: 'lectura', social: 'social', cuerpo: 'cuerpo', notas: 'notas', progreso: 'progreso' };

const DEF = {
  cfg: { url: '', token: '', meta: 10, apps: ['Instagram', 'TikTok', 'X'], limite: 15 },
  lectura: [], libros: [], social: [], redes: [], pantalla: [], canvas: [],
  xp: [], notas: [], agua: [], salud: [], enfoque: [], repaso: [], personas: [], tienda: [], canjes: [],
  queue: [], swap: { f: '', n: 0 }, canvasOn: false,
  inicio: '', intro: false, mision: null, ab: { lug: 'casa', min: 10 }, timer: null, c40: { nivel: 1, mejor: 0 }
};

let S = JSON.parse(JSON.stringify(DEF));
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* vacío o bloqueado */ }
S.cfg = Object.assign({}, DEF.cfg, S.cfg);
for (const k in DEF) if (S[k] === undefined) S[k] = JSON.parse(JSON.stringify(DEF[k]));

const D = { frases: [], retos: {}, preguntas: {}, ap: { ventas: [], objeciones: [], negocios: [], casos: [], tech: [], ingles: [], rutinas: [], misiones: [] } };
const ui = {
  tab: 'hoy', sub: { misiones: 'aburrido', diario: 'lectura', progreso: 'nivel' },
  sit: 'conocer', q: 0, form: '', rate: 0, sync: '', verHechas: false, pulled: false,
  draft: {}, sim: null, caso: null, rep: {}, c40: null, minimo: {}, notaFiltro: 'todas', notaBusca: '', biblioBusca: '',
  overlay: null, guionTipo: 'apertura', etiqueta: 'idea', carta: 3, energia: 0
};

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = () => iso(new Date());
const ahora = () => { const d = new Date(); return `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
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
const dia = r => String(r['Fecha y hora'] || r.Fecha || '').slice(0, 10);
const rnd = n => Math.floor(Math.random() * n);
const plural = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;
if (!S.inicio) { S.inicio = hoy(); save(); }

function toast(t, tipo) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = t; el.className = 'show' + (tipo ? ' ' + tipo : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.className = ''; }, tipo === 'scarlet' ? 2600 : 1900);
}
function copiar(t) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copiado')).catch(() => { window.prompt('Copia este texto:', t); });
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
      const r = await fetch(S.cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: S.cfg.token }, S.queue[0])) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'error');
      S.queue.shift(); save();
    }
    ui.sync = '';
  } catch (e) {
    ui.sync = e.message === 'token' ? 'El token no coincide con el del Apps Script.' : e.message === 'tab' ? 'Actualiza Code.gs y publica una nueva versión: faltan pestañas nuevas.' : 'Sin conexión con el Sheet; se reintentará.';
  }
  busy = false;
}
async function pull(manual) {
  if (!S.cfg.url) { ui.pulled = true; return; }
  await flush();
  if (S.queue.length) { if (manual) { toast('No se pudo sincronizar'); render(); } return; }
  try {
    const r = await fetch(url('all'));
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'error');
    if (S.queue.length) return;
    for (const k in TABS) if (Array.isArray(j.data[TABS[k]])) S[k] = j.data[TABS[k]];
    S.canvasOn = !!j.data._canvas;
    ui.sync = ''; ui.pulled = true; save();
    evaluar(); render();
    if (manual) toast('Sincronizado');
  } catch (e) {
    ui.sync = e.message === 'token' ? 'El token no coincide con el del Apps Script.' : 'No se pudo leer el Sheet.';
    if (manual) { toast('No se pudo sincronizar'); render(); }
  }
}
async function syncCanvas() {
  if (!S.cfg.url) return toast('Primero conecta el Sheet en Progreso › Ajustes');
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

/* ---------- XP, atributos y rangos ---------- */
const hasMot = m => S.xp.some(r => r.Motivo === m);
const startsMot = p => S.xp.filter(r => String(r.Motivo).startsWith(p));
const xpTotal = () => S.xp.reduce((t, r) => t + num(r.Puntos), 0);
const attrXP = a => S.xp.filter(r => r.Atributo === a).reduce((t, r) => t + num(r.Puntos), 0);
const attrNivel = a => Math.floor(Math.sqrt(Math.max(0, attrXP(a)) / 20)) + 1;
const rangoIdx = xp => { let i = 0; RANGOS.forEach((r, k) => { if (xp >= r.xp) i = k; }); return i; };
const temporada = () => TEMPORADAS[new Date().getMonth() + 1];
const gastado = () => S.canjes.reduce((t, r) => t + num(r.Costo), 0);
const saldo = () => Math.max(0, xpTotal() - gastado());

function diaAttrs(f) {
  return new Set(S.xp.filter(r => dia(r) === f && num(r.Puntos) > 0 && !/^(combo|logro|jefe|redes|escudo|libro):/.test(r.Motivo)).map(r => r.Atributo));
}
const comboHoy = () => hasMot('combo:' + hoy());

/* Da XP una sola vez por motivo. Devuelve los puntos dados (0 si ya existía). */
function award(attr, pts, motivo, detalle, opt) {
  opt = opt || {};
  if (motivo && hasMot(motivo)) return 0;
  const antesTotal = xpTotal(), antesNivel = attrNivel(attr);
  let p = pts;
  if (opt.mult !== false && p > 0) {
    if (temporada() === attr) p *= 2;
    if (comboHoy()) p *= 1.5;
    p = Math.round(p);
  }
  append('xp', { 'Fecha y hora': opt.fecha && opt.fecha < hoy() ? opt.fecha + ' 21:00:00' : ahora(), Atributo: attr, Puntos: p, Motivo: motivo || 'x:' + Date.now(), Detalle: detalle || '' });
  const rDespues = rangoIdx(xpTotal());
  if (rDespues > rangoIdx(antesTotal)) ui.overlay = { tipo: 'rango', i: rDespues };
  else if (attrNivel(attr) > antesNivel && !opt.silent) toast(`${attr} sube a nivel ${attrNivel(attr)}`, 'scarlet');
  else if (p > 0 && !opt.silent) toast(`+${p} XP · ${attr}`);
  else if (p < 0 && !opt.silent) toast(`${p} XP · ${attr}`, 'scarlet');
  if (motivo && !/^(combo|logro):/.test(motivo)) { checkCombo(); checkLogros(); }
  return p;
}
function checkCombo() {
  const f = hoy();
  if (!hasMot('combo:' + f) && diaAttrs(f).size >= 3) {
    award('Disciplina', 20, 'combo:' + f, '3 áreas en un día', { mult: false, silent: true });
    toast('¡Combo! XP ×1,5 el resto del día', 'scarlet');
  }
}

/* ---------- rachas, escudos, día mínimo ---------- */
const cubierto = f => hasMot('escudo:' + f) || hasMot('minimo:' + f);
function racha(fechas) {
  const set = new Set(fechas);
  let d = hoy(), n = 0;
  if (!set.has(d) && !cubierto(d)) d = addDays(d, -1);
  while (set.has(d) || cubierto(d)) { n++; d = addDays(d, -1); }
  return n;
}
const diasLectura = () => S.lectura.filter(r => num(r['Páginas']) > 0).map(r => r.Fecha);
const rachaLectura = () => racha(diasLectura());
const rachaSocial = () => racha(S.social.filter(r => r.Hecho === 'sí').map(r => r.Fecha));
const escudosDisp = () => S.canjes.filter(r => r.Premio === 'Escudo de racha').length - startsMot('escudo:').length;
function rachaRota() {
  const ayer = addDays(hoy(), -1), ante = addDays(hoy(), -2);
  const set = new Set(diasLectura());
  if (set.has(ayer) || cubierto(ayer)) return 0;
  if (!(set.has(ante) || cubierto(ante))) return 0;
  let d = ante, n = 0;
  while (set.has(d) || cubierto(d)) { n++; d = addDays(d, -1); }
  return n;
}

/* ---------- lectura, social, redes, agua ---------- */
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
const libroActual = () => [...S.libros].reverse().find(b => !b.Fin);
const paginasDe = libro => S.lectura.filter(r => r.Libro === libro).reduce((t, r) => t + num(r['Páginas']), 0);
const paginasDia = f => S.lectura.filter(r => r.Fecha === f).reduce((t, r) => t + num(r['Páginas']), 0);
const aperturas = (f, app) => S.redes.filter(r => dia(r) === f && (!app || r.App === app)).length;
const vasos = f => S.agua.filter(r => dia(r) === f).reduce((t, r) => t + (num(r.Vasos) || 1), 0);
const saludDe = f => S.salud.find(r => r.Fecha === f);
const notaDe = (f, tipo) => S.notas.find(r => r['Fecha y hora'] === f && r.Tipo === tipo);
const fraseHoy = () => D.frases.length ? D.frases[dayOfYear(hoy()) % D.frases.length] : null;

/* ---------- Canvas ---------- */
function tareas() {
  const now = Date.now();
  return S.canvas.map(r => {
    const d = new Date(String(r.Vence).replace(' ', 'T'));
    return Object.assign({}, r, { d, h: (d - now) / 36e5, done: r.Entregado === 'sí' });
  }).filter(r => !isNaN(r.d)).sort((a, b) => a.d - b.d);
}
const pendientes = () => tareas().filter(r => !r.done && r.h > -24 * 7);
const pruebasProximas = dias => tareas().filter(r => r.Tipo === 'prueba' && !r.done && r.h > 0 && r.h <= 24 * dias);
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
const promptPrueba = r => `Tengo una prueba de ${r.Materia}: "${r['Título']}" el ${cuando(r)}. Explícame los temas que suelen entrar como si los viera por primera vez, con ejemplos. Después hazme 10 preguntas tipo prueba, una a la vez, y corrígeme cada respuesta.`;

/* ---------- aprender: contenidos y repaso espaciado ---------- */
function itemPorId(id) {
  const tipos = { v: 'ventas', n: 'negocios', i: 'ingles', o: 'objeciones', c: 'casos', t: 'tech', r: 'rutinas', m: 'misiones' };
  const lista = D.ap[tipos[id[0]]] || [];
  return lista.find(x => x.id === id);
}
const titulo = it => it ? (it.t || it.en || it.o || it.r || it.c || it.nombre || '') : '';
const explic = it => it ? (it.e ? `${it.e}${it.ej ? '\n\nEjemplo: ' + it.ej : ''}` : it.es ? `${it.es}\n\nUso: ${it.uso}` : '') : '';
const espartano = () => rangoIdx(xpTotal()) >= 2;
const repasoDe = id => S.repaso.find(r => r.ID === id);
const repasosPend = () => S.repaso.filter(r => num(r.Paso) < 3 && String(r.Siguiente) <= hoy());
const dominados = () => S.repaso.filter(r => num(r.Paso) >= 3);
function addRepaso(id) {
  if (!repasoDe(id)) upsert('repaso', ['ID'], { ID: id, Paso: 0, Siguiente: addDays(hoy(), 1), Visto: hoy() });
}
function conceptoDelDia(tipo) {
  let lista = D.ap[tipo].filter(x => !x.adv || espartano());
  if (!lista.length) return null;
  const nuevos = lista.filter(x => !repasoDe(x.id));
  const pool = nuevos.length ? nuevos : lista;
  return pool[dayNum(hoy()) % pool.length];
}

/* ---------- jefe semanal ---------- */
const POOL_JEFE = [
  { k: 'paginas', t: n => `Leer ${n} páginas`, n: [50, 70, 100] },
  { k: 'retos', t: n => `Hacer ${n} retos sociales`, n: [3, 4, 5] },
  { k: 'misiones', t: n => `Completar ${n} misiones`, n: [4, 6, 8] },
  { k: 'enfoque', t: n => `${n} bloques de enfoque`, n: [3, 5, 7] },
  { k: 'agua', t: n => `${n} días con 8 vasos de agua`, n: [3, 4, 5] },
  { k: 'repasos', t: n => `${n} repasos`, n: [8, 12, 15] },
  { k: 'rutinas', t: n => `${n} rutinas de ejercicio`, n: [2, 3, 3] },
  { k: 'redes', t: n => `Menos de ${n} aperturas de redes`, n: [80, 70, 60], cap: true }
];
function jefe(lun) {
  lun = lun || lunes(hoy());
  const seed = Math.round(dayNum(lun) / 7);
  const dif = Math.min(2, Math.floor(rangoIdx(xpTotal()) / 2));
  const idx = [];
  for (let i = 0; idx.length < 4; i++) { const k = (seed * 3 + i * 5) % POOL_JEFE.length; if (!idx.includes(k)) idx.push(k); }
  const dias = Array.from({ length: 7 }, (_, i) => addDays(lun, i));
  const enSem = r => dias.includes(dia(r));
  const prog = {
    paginas: dias.reduce((t, f) => t + paginasDia(f), 0),
    retos: S.social.filter(r => dias.includes(r.Fecha) && r.Hecho === 'sí').length,
    misiones: S.xp.filter(r => enSem(r) && String(r.Motivo).startsWith('aburrido:')).length,
    enfoque: S.enfoque.filter(enSem).length,
    agua: dias.filter(f => vasos(f) >= 8).length,
    repasos: S.xp.filter(r => enSem(r) && String(r.Motivo).startsWith('rep:')).length,
    rutinas: S.xp.filter(r => enSem(r) && String(r.Motivo).startsWith('rutina:')).length,
    redes: dias.reduce((t, f) => t + aperturas(f), 0)
  };
  const finde = [0, 6].includes(new Date().getDay());
  const metas = idx.map(k => {
    const g = POOL_JEFE[k], n = g.n[dif], v = prog[g.k];
    const ok = g.cap ? v < n && finde : v >= n;
    return { t: g.t(n), v, n, ok, cap: g.cap };
  });
  return { nombre: JEFES[seed % JEFES.length], lun, metas, listo: metas.every(m => m.ok), derrotado: startsMot('jefe:' + lun + ':').length > 0 };
}

/* ---------- logros ---------- */
const LOGROS = [
  { id: 'libro1', n: 'Primer libro terminado', a: 'Disciplina', c: () => S.libros.some(b => b.Fin) },
  { id: 'pag100', n: '100 páginas leídas', a: 'Disciplina', c: () => S.lectura.reduce((t, r) => t + num(r['Páginas']), 0) >= 100 },
  { id: 'pag1000', n: '1.000 páginas leídas', a: 'Disciplina', c: () => S.lectura.reduce((t, r) => t + num(r['Páginas']), 0) >= 1000 },
  { id: 'racha7', n: '7 días seguidos leyendo', a: 'Disciplina', c: () => rachaLectura() >= 7 },
  { id: 'racha30', n: '30 días seguidos leyendo', a: 'Disciplina', c: () => rachaLectura() >= 30 },
  { id: 'reto1', n: 'Primer reto social', a: 'Carisma', c: () => S.social.some(r => r.Hecho === 'sí') },
  { id: 'social3', n: 'Nivel social 3', a: 'Carisma', c: () => nivel().l >= 3 },
  { id: 'social5', n: 'Nivel social 5', a: 'Carisma', c: () => nivel().l >= 5 },
  { id: 'redes7', n: '7 días bajo el límite de redes', a: 'Enfoque', c: () => S.xp.filter(r => String(r.Motivo).startsWith('redes:') && num(r.Puntos) > 0).length >= 7 },
  { id: 'jefe1', n: 'Primer jefe derrotado', a: 'Disciplina', c: () => startsMot('jefe:').length > 0 },
  { id: 'jefe5', n: '5 jefes derrotados', a: 'Disciplina', c: () => new Set(startsMot('jefe:').map(r => r.Motivo.split(':')[1])).size >= 5 },
  { id: 'mis10', n: '10 misiones en vez de scroll', a: 'Enfoque', c: () => startsMot('aburrido:').length >= 10 },
  { id: 'mis50', n: '50 misiones en vez de scroll', a: 'Enfoque', c: () => startsMot('aburrido:').length >= 50 },
  { id: 'enf1', n: 'Primer bloque de enfoque', a: 'Mente', c: () => S.enfoque.length > 0 },
  { id: 'enf10', n: '10 horas de enfoque', a: 'Mente', c: () => S.enfoque.reduce((t, r) => t + num(r.Minutos), 0) >= 600 },
  { id: 'dom20', n: '20 conceptos dominados', a: 'Mente', c: () => dominados().length >= 20 },
  { id: 'tech10', n: '10 retos de Go, redes o ciber', a: 'Mente', c: () => startsMot('tech:').length >= 10 },
  { id: 'sim10', n: '10 llamadas simuladas', a: 'Carisma', c: () => startsMot('sim:').length >= 10 },
  { id: 'c40', n: 'Ronda perfecta de Cuarenta en nivel 5', a: 'Mente', c: () => num(S.c40.mejor) >= 5 },
  { id: 'agua7', n: '7 días con 8 vasos de agua', a: 'Fuerza', c: () => startsMot('agua:').length >= 7 },
  { id: 'pasos10k', n: '10.000 pasos en un día', a: 'Fuerza', c: () => S.salud.some(r => num(r.Pasos) >= 10000) },
  { id: 'ritual7', n: '7 rituales nocturnos', a: 'Disciplina', c: () => S.notas.filter(r => r.Tipo === 'ritual').length >= 7 },
  { id: 'vict1', n: 'Primera victoria anotada', a: 'Disciplina', c: () => S.notas.some(r => r.Tipo === 'victoria') },
  { id: 'combo1', n: 'Primer combo del día', a: 'Disciplina', c: () => startsMot('combo:').length > 0 }
];
function checkLogros() {
  const nuevos = LOGROS.filter(l => !hasMot('logro:' + l.id) && l.c());
  nuevos.forEach(l => award(l.a, 25, 'logro:' + l.id, l.n, { mult: false, silent: true }));
  if (nuevos.length === 1) toast('Logro: ' + nuevos[0].n);
  else if (nuevos.length > 1) toast(`${nuevos.length} logros desbloqueados`);
}

/* ---------- evaluación diaria (idempotente) ---------- */
function evaluar() {
  const f0 = hoy(), o = { mult: false, silent: true }, fo = f => ({ mult: false, silent: true, fecha: f });
  S.lectura.forEach(r => {
    if (num(r['Páginas']) > 0) award('Disciplina', 8, 'leer:' + r.Fecha, 'Lectura', fo(r.Fecha));
    if (paginasDia(r.Fecha) >= (num(S.cfg.meta) || 10)) award('Disciplina', 7, 'meta:' + r.Fecha, 'Meta de lectura', fo(r.Fecha));
  });
  S.social.forEach(r => { if (r.Hecho === 'sí') award('Carisma', 15, 'reto:' + r.Fecha, r.Reto, fo(r.Fecha)); });
  S.libros.forEach(b => { if (b.Fin) award('Disciplina', 40, `libro:${b.Libro}:${b.Inicio}`, b.Libro, o); });
  const desdeCanvas = addDays(S.inicio, -7);
  tareas().forEach(r => { if (r.done && dia({ Fecha: String(r.Vence) }) >= desdeCanvas) award('Mente', r.Prioridad === 'Alta' ? 25 : 15, 'canvas:' + r.ID, r['Título'], o); });
  [...new Set(S.agua.map(dia))].forEach(f => { if (vasos(f) >= 8) award('Fuerza', 12, 'agua:' + f, '8 vasos', fo(f)); });
  S.salud.forEach(r => {
    if (num(r.Pasos) >= 8000) award('Fuerza', 10, 'pasos:' + r.Fecha, num(r.Pasos) + ' pasos', fo(r.Fecha));
    if (num(r['Sueño']) >= 7) award('Disciplina', 8, 'sueno:' + r.Fecha, num(r['Sueño']) + ' h', fo(r.Fecha));
  });
  if (ui.pulled) {
    const lim = num(S.cfg.limite) || 15;
    let d = S.inicio > addDays(f0, -14) ? S.inicio : addDays(f0, -14);
    for (; d < f0; d = addDays(d, 1)) {
      if (hasMot('redes:' + d)) continue;
      const n = aperturas(d);
      award('Enfoque', n <= lim ? 10 : -Math.min(15, n - lim), 'redes:' + d, `${n} aperturas`, fo(d));
    }
  }
  checkCombo(); checkLogros();
}

/* ---------- misión de "estoy aburrido" ---------- */
const TIPO_NOMBRE = { ventas: 'Ventas', negocios: 'Negocios', ingles: 'Inglés', sim: 'Simulador de llamada', caso: 'Caso de negocio', cuarenta: 'Cuarenta', tech: 'Go, redes y ciber', repaso: 'Repaso', prueba: 'Modo prueba', texto: 'Misión' };
const TIPO_ATTR = { ventas: 'Mente', negocios: 'Mente', ingles: 'Mente', sim: 'Carisma', caso: 'Mente', cuarenta: 'Mente', tech: 'Mente', repaso: 'Mente', prueba: 'Mente' };
function generarMision(excluir) {
  const { lug, min } = S.ab, c = [];
  const add = (tipo, item, peso) => { if (!item || (excluir && (item.id || tipo) === excluir)) return; for (let i = 0; i < peso; i++) c.push({ tipo, item }); };
  const pr = pruebasProximas(3)[0];
  if (pr && lug !== 'calle' && !hasMot(`prueba:${hoy()}:${pr.ID}`)) add('prueba', { id: 'p' + pr.ID, canvas: pr.ID }, 6);
  if (repasosPend().length) add('repaso', { id: 'repaso' }, 3);
  const nuevo = tipo => { const l = D.ap[tipo].filter(x => (!x.adv || espartano()) && !repasoDe(x.id)); return l.length ? l[rnd(l.length)] : D.ap[tipo][rnd(D.ap[tipo].length)]; };
  if (D.ap.ventas.length) add('ventas', nuevo('ventas'), 3);
  if (D.ap.negocios.length) add('negocios', nuevo('negocios'), 2);
  if (D.ap.ingles.length) add('ingles', nuevo('ingles'), 2);
  if (min >= 10 && lug !== 'bus' && D.ap.objeciones.length) add('sim', D.ap.objeciones[rnd(D.ap.objeciones.length)], 2);
  if (min >= 10) { const l = D.ap.casos.filter(x => !hasMot('caso:' + x.id)); if (l.length) add('caso', l[rnd(l.length)], 2); }
  add('cuarenta', { id: 'cuarenta' }, 1);
  if (min >= 20 && (lug === 'casa' || lug === 'u')) {
    const nv = Math.min(3, 1 + Math.floor(rangoIdx(xpTotal()) / 2));
    const l = D.ap.tech.filter(x => x.n <= nv && !hasMot('tech:' + x.id));
    if (l.length) add('tech', l[rnd(l.length)], 2);
  }
  D.ap.misiones.filter(m => m.lug.includes(lug) && m.min <= min).forEach(m => add('texto', m, 1));
  if (!c.length) return null;
  const p = c[rnd(c.length)];
  return { tipo: p.tipo, id: p.item.id || p.tipo, ts: Date.now(), saltos: 0 };
}
function completarMision(detalle) {
  if (!S.mision) return;
  award('Enfoque', 5, 'aburrido:' + S.mision.ts, detalle || TIPO_NOMBRE[S.mision.tipo], { silent: true });
  S.mision = null; save();
}

/* ---------- Cuarenta ---------- */
const C40_R = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
const C40_P = [['♠', 'negro'], ['♥', 'rojo'], ['♦', 'rojo'], ['♣', 'negro']];
let c40Timer = null;
function c40Empezar(enMision) {
  const nv = Math.max(1, num(S.c40.nivel) || 1);
  const mazo = []; C40_R.forEach(r => C40_P.forEach(p => mazo.push({ r, p: p[0], col: p[1] })));
  for (let i = mazo.length - 1; i > 0; i--) { const j = rnd(i + 1); [mazo[i], mazo[j]] = [mazo[j], mazo[i]]; }
  const n = Math.min(30, 6 + 2 * nv), salidas = mazo.slice(0, n);
  const pregs = [];
  const usados = new Set();
  while (pregs.length < 3) {
    if (pregs.length === 2 && rnd(2)) { pregs.push({ t: '¿Cuántas cartas quedan en el mazo?', r: 40 - n, op: [40 - n - 2, 40 - n, 40 - n + 2, 40 - n - 4].sort((a, b) => a - b) }); break; }
    const r = C40_R[rnd(10)];
    if (usados.has(r)) continue; usados.add(r);
    pregs.push({ t: `¿Cuántos ${r} quedan sin salir?`, r: 4 - salidas.filter(c => c.r === r).length, op: [0, 1, 2, 3, 4] });
  }
  ui.c40 = { fase: 'mostrando', cartas: salidas, i: 0, pregs, k: 0, ok: 0, nv, vel: Math.max(550, 1400 - 100 * nv), enMision };
  c40Paso();
}
function c40Paso() {
  clearTimeout(c40Timer);
  if (!ui.c40 || ui.c40.fase !== 'mostrando') return;
  render();
  c40Timer = setTimeout(() => {
    if (!ui.c40) return;
    ui.c40.i++;
    if (ui.c40.i >= ui.c40.cartas.length) { ui.c40.fase = 'pregunta'; render(); } else c40Paso();
  }, ui.c40.vel);
}
function c40Responder(v) {
  const g = ui.c40, p = g.pregs[g.k];
  if (Number(v) === p.r) g.ok++;
  g.ultima = { bien: Number(v) === p.r, r: p.r };
  g.k++;
  if (g.k >= g.pregs.length) {
    g.fase = 'resultado';
    if (g.ok === 3) { S.c40.nivel = g.nv + 1; S.c40.mejor = Math.max(num(S.c40.mejor), g.nv); }
    else if (g.ok <= 1) S.c40.nivel = Math.max(1, g.nv - 1);
    save();
    award('Mente', 5 + 3 * g.ok, 'cuarenta:' + Date.now(), `${g.ok}/3 en nivel ${g.nv}`);
    if (g.enMision) completarMision('Cuarenta');
  }
}

/* ---------- componentes visuales ---------- */
const AREA_ICON = {
  hoy: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  clases: '<path d="M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M2 10l10-6 10 6z"/>',
  mis: '<path d="M14.5 3.5 20.5 9.5 9 21H3v-6z"/><path d="m12 6 6 6"/>',
  lectura: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13v2H6"/>',
  social: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  cuerpo: '<circle cx="13" cy="4" r="2"/><path d="m4 21 4-6 4 2 2-6 4 3M10 9l3-2 3 4"/>',
  notas: '<path d="M4 20c4-1 7-4 9-8l5-8c1 3 0 6-2 9-3 4-7 6-12 7z"/><path d="M4 20 13 11"/>',
  progreso: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
  diario: '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h8M8 12h8M8 16h5"/>'
};
const ico = (k, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${AREA_ICON[k] || ''}</svg>`;
/* Tarjeta: tipo = mision | registro | info ; zona = color del área */
function card(zona, tipo, titulo, cuerpo, extra) {
  return `<section class="card ${tipo}" style="--acc:var(--c-${zona})">${titulo ? `<div class="card-h"><h2>${ico(zona)}${titulo}</h2>${extra || ''}</div>` : ''}${cuerpo}</section>`;
}
const chip = (t, on) => `<span class="tag ${on ? 'on' : ''}">${t}</span>`;
const xpChip = n => `<span class="xp">+${n} XP</span>`;
const draft = (k, def) => ui.draft[k] !== undefined ? ui.draft[k] : (def || '');

function hero(kind) {
  const motif = {
    hoy: '<circle cx="250" cy="58" r="24" fill="#f9e7a8" opacity=".85"/><g fill="#060504"><path d="M196 104c0-3 1.6-5 4-5s4 2 4 5-1.6 5-4 5-4-2-4-5zm-3 6h14l2 13-3 1-2-9v16h-3v-11h-2v11h-3v-16l-2 9-3-1z"/></g>',
    clases: '<g fill="#060504"><path d="M140 70h120l-60-26z"/><rect x="146" y="72" width="108" height="6"/>' + [152, 174, 196, 218, 240].map(x => `<rect x="${x}" y="80" width="8" height="40"/>`).join('') + '<rect x="140" y="120" width="120" height="8"/></g>',
    mis: '<path d="M200 150 C 205 120, 260 110, 240 90 S 210 70, 228 56" stroke="#060504" stroke-width="7" fill="none" opacity=".75"/><g fill="#060504"><path d="M226 44c0-2 1.2-3.6 3-3.6s3 1.6 3 3.6-1.2 3.6-3 3.6-3-1.6-3-3.6zm-2 5h10l1.5 9-2 .6-1.5-6v11h-2v-8h-1.5v8h-2v-11l-1.5 6-2-.6z"/></g>',
    diario: '<g fill="#060504"><path d="M150 112c20-10 40-10 50 0 10-10 30-10 50 0V70c-20-10-40-10-50 0-10-10-30-10-50 0z"/></g><path d="M200 72v38" style="stroke:var(--acc)" stroke-width="1.5" opacity=".6"/>',
    progreso: '<g fill="#060504"><path d="M200 44l-26 10v20c0 18 12 30 26 36 14-6 26-18 26-36V54z"/><rect x="236" y="30" width="4" height="96"/><path d="M238 18l6 14h-12z"/></g>'
  }[kind] || '';
  return `<svg class="hero" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><radialGradient id="g-${kind}" cx="62%" cy="38%" r="65%"><stop offset="0" style="stop-color:var(--acc-hi)"/><stop offset=".38" style="stop-color:var(--acc)"/><stop offset="1" stop-color="#060504"/></radialGradient></defs>
    <rect width="400" height="150" fill="url(#g-${kind})"/>
    <path d="M0 150V112c30-8 52-28 80-30s46 18 72 14 40-26 68-24 44 22 72 18 50-26 108-22v82z" fill="#1a1409" opacity=".9"/>
    <path d="M0 150v-26c28-4 50-22 76-22s44 16 70 12 42-20 70-18 44 18 72 14 56-22 112-18v58z" fill="#0d0a05"/>
    ${motif}
    <path d="M0 150v-10c40-2 70-16 104-16s52 12 84 10 44-16 76-14 50 14 80 12 40-10 56-8v26z" fill="#060504"/>
  </svg>`;
}
const header = (t, sub) => `<header>${sub ? `<p class="fecha">${sub}</p>` : ''}<h1>${t}</h1><div class="rule" aria-hidden="true"></div></header>`;
function subnav(tab, ops) {
  return `<div class="subnav" role="tablist">${ops.map(([k, t, z]) => `<button role="tab" data-a="sub" data-v="${tab}:${k}" class="${ui.sub[tab] === k ? 'on' : ''}" style="--acc:var(--c-${z})">${t}</button>`).join('')}</div>`;
}
function rangoMini() {
  const xp = xpTotal(), i = rangoIdx(xp), sig = RANGOS[i + 1];
  const pct = sig ? Math.round((xp - RANGOS[i].xp) / (sig.xp - RANGOS[i].xp) * 100) : 100;
  return `<button class="rango-mini" data-a="tab" data-v="progreso"><span class="r">${RANGOS[i].n}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="muted">${xp} XP</span></button>`;
}

/* ---- tarjetas reutilizables ---- */
function abCard() {
  if (S.mision) return misionCard();
  const { lug, min } = S.ab;
  return card('mis', 'mision hero-card', '¿Estás aburrido?', `
    <p class="big">Antes de abrir redes, haz una misión corta y gana XP.</p>
    <label>¿Dónde estás?</label>
    <div class="seg">${Object.keys(LUGARES).map(k => `<button data-a="ab-lug" data-v="${k}" class="${lug === k ? 'on' : ''}">${LUGARES[k]}</button>`).join('')}</div>
    <label>¿Cuánto tiempo tienes?</label>
    <div class="seg">${[5, 10, 20].map(m => `<button data-a="ab-min" data-v="${m}" class="${min === m ? 'on' : ''}">${m} min</button>`).join('')}</div>
    <button class="pri xl" data-a="ab-dame">Estoy aburrido</button>`);
}
function misionCard() {
  const m = S.mision;
  const item = m.tipo === 'texto' ? D.ap.misiones.find(x => x.id === m.id) : m.tipo === 'sim' ? D.ap.objeciones.find(x => x.id === m.id) : m.tipo === 'caso' ? D.ap.casos.find(x => x.id === m.id) : m.tipo === 'tech' ? D.ap.tech.find(x => x.id === m.id) : m.tipo === 'prueba' ? tareas().find(r => 'p' + r.ID === m.id) : itemPorId(m.id) || { id: m.id };
  return card('mis', 'mision hero-card', `Misión · ${TIPO_NOMBRE[m.tipo]}`, `${itemBody(m.tipo, item, 'mision')}
    <div class="row" style="margin-top:12px">${m.saltos < 2 ? `<button class="ghost" data-a="ab-otra">Otra misión (${2 - m.saltos})</button>` : ''}<button class="ghost" data-a="ab-cancelar">Cancelar</button></div>`, xpChip(5) + '');
}
/* Cuerpo de un ítem de aprendizaje; ctx = 'mision' | 'modulo' */
function itemBody(tipo, it, ctx) {
  if (!it) return '<p class="muted">Este contenido ya no está disponible.</p>';
  const c = `data-c="${ctx}"`;
  if (tipo === 'ventas' || tipo === 'negocios') {
    const visto = !!repasoDe(it.id);
    return `<p class="big">${esc(it.t)}</p><p>${esc(it.e)}</p><p class="ejemplo">${esc(it.ej)}</p>
      ${tipo === 'negocios' ? '<p class="muted small">Para aprender; no es asesoría financiera.</p>' : ''}
      <button class="pri" ${c} data-a="concepto" data-v="${it.id}">${visto && ctx !== 'mision' ? 'Ya lo aprendiste ✓' : 'Lo entendí'}</button>`;
  }
  if (tipo === 'ingles') {
    return `<p class="big" lang="en">${esc(it.en)}</p><p>${esc(it.es)}</p><p class="muted">Úsala para: ${esc(it.uso)}</p>
      <p class="muted small">Dila en voz alta 3 veces, cada vez más natural.</p><button class="pri" ${c} data-a="ingles" data-v="${it.id}">La practiqué</button>`;
  }
  if (tipo === 'sim') {
    const st = ui.sim && ui.sim.id === it.id ? ui.sim : { id: it.id, rev: false, rate: 0 };
    return `<p class="muted">Cliente: ${esc(it.cliente)}</p><p class="big">"${esc(it.o)}"</p>
      <label for="sim-${it.id}">Tu respuesta (dila en voz alta o escríbela)</label>
      <textarea id="sim-${it.id}" data-draft="sim-${it.id}">${esc(draft('sim-' + it.id))}</textarea>
      ${st.rev ? `<div class="modelo"><b>Respuesta modelo</b><p>${esc(it.r)}</p></div>
        <label>¿Qué tan bien te salió?</label><div class="rate">${[1, 2, 3, 4, 5].map(n => `<button data-a="sim-rate" data-v="${n}" class="${st.rate === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <button class="pri" ${c} data-a="sim-fin" data-v="${it.id}">Guardar práctica</button>`
      : `<button class="pri" data-a="sim-ver" data-v="${it.id}">Ver respuesta modelo</button>`}`;
  }
  if (tipo === 'caso') {
    const rev = ui.caso === it.id;
    return `<p class="big">${esc(it.c)}</p><label for="caso-${it.id}">¿Qué harías?</label>
      <textarea id="caso-${it.id}" data-draft="caso-${it.id}">${esc(draft('caso-' + it.id))}</textarea>
      ${rev ? `<div class="modelo"><b>Un análisis posible</b><p>${esc(it.a)}</p></div><button class="pri" ${c} data-a="caso-fin" data-v="${it.id}">Listo</button>` : `<button class="pri" data-a="caso-ver" data-v="${it.id}">Ver análisis</button>`}`;
  }
  if (tipo === 'tech') {
    return `<span class="tag">${esc(it.area)} · nivel ${it.n}</span><p class="big" style="margin-top:8px">${esc(it.r)}</p>
      <div class="row"><button class="pri grow" ${c} data-a="tech" data-v="${it.id}">Lo hice</button><button class="ghost" data-a="copiar" data-v="${esc('Ayúdame con este ejercicio sin darme la respuesta completa; dame pistas: ' + it.r)}">Pistas con Claude</button></div>`;
  }
  if (tipo === 'cuarenta') return `<p class="big">Ronda del entrenador de Cuarenta</p><p class="muted">Cartas que salen una a una; luego 3 preguntas sobre lo que queda.</p><button class="pri" data-a="c40-ir" data-v="mision">Empezar ronda</button>`;
  if (tipo === 'repaso') return `<p class="big">${plural(repasosPend().length, 'repaso pendiente', 'repasos pendientes')}</p><p class="muted">Repasa lo que aprendiste para que no se te olvide.</p><button class="pri" data-a="ir" data-v="misiones:repaso">Ir a repasar</button>`;
  if (tipo === 'prueba') return `<p class="big">Prueba de ${esc(it.Materia)}: ${esc(it['Título'])}</p><p class="muted">${cuando(it)}. Copia el prompt, ábrelo en Claude y estudia 10 minutos.</p>
    <div class="row"><button class="grow" data-a="copiar" data-v="${esc(promptPrueba(it))}">Copiar prompt</button><button class="pri grow" ${c} data-a="prueba-fin" data-v="${it.ID}">Hecho</button></div>`;
  if (tipo === 'texto') {
    return `<p class="big">${esc(it.t)}</p><div class="row">${chip(it.a)} ${it.xp ? xpChip(it.xp) : ''}</div>
      <button class="pri" style="margin-top:12px" data-a="texto-fin" data-v="${it.id}">${it.accion === 'enfoque' ? 'Empezar enfoque' : it.accion === 'rutina' ? 'Elegir rutina' : 'Hecho'}</button>`;
  }
  return '';
}

function clasesCard() {
  const p = pendientes();
  if (!S.cfg.url || !p.length) return '';
  const alta = p.filter(r => r.Prioridad === 'Alta').length;
  return card('clases', 'registro', 'Clases', `<ul class="list">${p.slice(0, 3).map(tareaItem).join('')}</ul>
    ${p.length > 3 ? `<button class="sm ghost" data-a="tab" data-v="clases" style="margin-top:8px">Ver las ${p.length}</button>` : ''}`, chip(`${p.length} pendientes${alta ? ` · ${alta} alta` : ''}`, alta));
}
function tareaItem(r) {
  const vencida = r.h <= 0 && !r.done;
  return `<li class="tarea ${vencida ? 'vencida' : ''}"><div class="row between"><span class="materia">${esc(r.Materia)}</span><span class="prio ${esc(r.Prioridad).toLowerCase()}">${esc(r.Prioridad)}</span></div>
    <a class="titulo" href="${esc(r.Link)}" target="_blank" rel="noopener">${esc(r['Título'])}</a>
    <small>${r.Tipo === 'prueba' ? 'Prueba' : 'Tarea'} · ${cuando(r)} · ${num(r.Peso)}% de la nota${num(r.Puntos) ? ` · ${num(r.Puntos)} pts` : ''}${r.done ? ' · entregada' : ''}</small></li>`;
}
function retoCard() {
  const r = retoHoy();
  let body;
  if (ui.form === 'reto') {
    body = `<label>¿Cómo te fue?</label><div class="rate">${[1, 2, 3, 4, 5].map(n => `<button data-a="rate" data-v="${n}" class="${ui.rate === n ? 'on' : ''}" aria-label="${n} de 5">${n}</button>`).join('')}</div>
      <label for="nota">Nota (opcional)</label><textarea id="nota" placeholder="¿Qué pasó? ¿Qué harías distinto?">${esc(r.reg ? r.reg.Nota : '')}</textarea>
      <div class="row" style="margin-top:10px"><button class="pri grow" data-a="reto-guardar">Guardar</button><button class="ghost" data-a="cancelar">Cancelar</button></div>`;
  } else if (r.reg) {
    const si = r.reg.Hecho === 'sí';
    body = `<p class="${si ? 'ok' : 'muted'}">${si ? '✓ Hecho' + (num(r.reg['Cómo te fue']) ? ` · te fue ${num(r.reg['Cómo te fue'])}/5` : '') : 'Hoy no lo hiciste. Mañana hay otro.'}</p>${r.reg.Nota ? `<p class="muted">${esc(r.reg.Nota)}</p>` : ''}<button class="sm" data-a="reto-si">${si ? 'Editar' : 'Sí lo hice'}</button>`;
  } else {
    body = `<div class="row"><button class="pri grow" data-a="reto-si">Lo hice</button><button data-a="reto-no">Hoy no</button><button class="ghost" data-a="reto-otro">Cambiar</button></div>`;
  }
  return card('social', r.reg ? 'registro' : 'mision', 'Reto social de hoy', `<p class="big">${esc(r.texto) || 'Cargando retos…'}</p>${body}`, chip(`Nivel ${r.l} · ${NIVELES[r.l - 1]}`));
}
function libroForm() {
  return `<label for="l-t">Título</label><input id="l-t" autocomplete="off"><label for="l-a">Autor</label><input id="l-a" autocomplete="off">
    <label for="l-p">Páginas totales</label><input id="l-p" type="number" inputmode="numeric" min="1">
    <div class="row" style="margin-top:12px"><button class="pri grow" data-a="libro-guardar">Empezar este libro</button>${libroActual() ? '<button class="ghost" data-a="cancelar">Cancelar</button>' : ''}</div>`;
}
function lecturaCard() {
  const b = libroActual();
  if (!b || ui.form === 'libro') return card('lectura', 'registro', b ? 'Cambiar de libro' : 'Lectura', `${b ? '' : '<p class="muted">Agrega el libro que estás leyendo para empezar tu racha.</p>'}${libroForm()}`);
  const f = hoy(), reg = S.lectura.find(r => r.Fecha === f && r.Libro === b.Libro);
  const hechas = reg ? num(reg['Páginas']) : 0, meta = num(S.cfg.meta) || 10, leidas = paginasDe(b.Libro), total = num(b['Páginas totales']);
  return card('lectura', 'registro', 'Lectura', `<p class="big" style="margin-bottom:2px">${esc(b.Libro)}</p>
    <p class="muted">${esc(b.Autor || '')}${total ? ` · ${Math.min(leidas, total)} de ${total} páginas` : ` · ${leidas} páginas`}</p>
    ${total ? `<div class="bar"><i style="width:${Math.min(100, Math.round(leidas / total * 100))}%"></i></div>` : ''}
    <label for="pags">Páginas leídas hoy</label>
    <div class="row"><input id="pags" class="num" type="number" inputmode="numeric" min="0" value="${hechas || ''}" placeholder="0"><button class="pri grow" data-a="leer-guardar">Guardar</button></div>`, chip(`${hechas}/${meta} págs`, hechas >= meta));
}
function aguaCard() {
  const v = vasos(hoy());
  return card('cuerpo', 'registro', 'Agua', `<div class="vasos" aria-label="${v} de 8 vasos">${Array.from({ length: 8 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row between"><span class="muted">${v >= 8 ? 'Meta cumplida.' : `Te faltan ${8 - v}.`}</span><button class="pri" data-a="agua">+1 vaso</button></div>`, chip(`${v}/8`, v >= 8));
}
function ritualCard() {
  const r = notaDe(hoy(), 'ritual');
  if (r) return '';
  return card('notas', 'mision', 'Cierra el día', `<p class="muted">Un minuto. Da XP de Disciplina.</p>
    <label for="rt1">¿Qué hiciste bien hoy?</label><input id="rt1" data-draft="rt1" value="${esc(draft('rt1'))}">
    <label for="rt2">¿Qué mejoras mañana?</label><input id="rt2" data-draft="rt2" value="${esc(draft('rt2'))}">
    <label for="rt3">Una cosa que agradeces</label><input id="rt3" data-draft="rt3" value="${esc(draft('rt3'))}">
    <button class="pri" style="width:100%;margin-top:12px" data-a="ritual">Guardar ritual</button>`, xpChip(10));
}
function personasDue() {
  return S.personas.filter(p => !p['Último'] || addDays(String(p['Último']), num(p.Cada) || 14) <= hoy());
}
function personasCard(soloDue) {
  const lista = soloDue ? personasDue() : S.personas;
  if (soloDue && !lista.length) return '';
  const items = lista.map(p => {
    const due = personasDue().includes(p);
    return `<li class="row between"><span>${esc(p.Nombre)}<small>${p['Último'] ? `último contacto ${corta(String(p['Último']))}` : 'sin contacto anotado'} · cada ${num(p.Cada) || 14} días</small></span><button class="sm ${due ? 'pri' : ''}" data-a="persona" data-v="${esc(p.Nombre)}">Le escribí</button></li>`;
  }).join('');
  return card('social', soloDue ? 'mision' : 'registro', soloDue ? 'Escríbele a…' : 'Personas que no quieres perder', `${items ? `<ul class="list">${items}</ul>` : '<p class="muted">Agrega amigos o familia a los que no quieres dejar de escribir.</p>'}
    ${soloDue ? '' : `<div class="row" style="margin-top:12px"><input id="p-n" placeholder="Nombre" class="grow" autocomplete="off"><input id="p-c" type="number" inputmode="numeric" min="1" placeholder="Cada (días)" style="width:120px"><button class="pri" data-a="persona-add">Agregar</button></div>`}`);
}
function preguntasCard() {
  const lista = D.preguntas[ui.sit] || [];
  return card('social', 'info', 'Preguntas para conversar', `<div class="chips">${Object.keys(SITS).map(k => `<button data-a="sit" data-v="${k}" class="${ui.sit === k ? 'on' : ''}">${SITS[k]}</button>`).join('')}</div>
    <div class="pregunta">${esc(lista[ui.q % (lista.length || 1)] || '…')}</div><button class="pri" style="width:100%;margin-top:14px" data-a="otra">Otra pregunta</button>`);
}
function redesInfo() {
  const f = hoy(), n = aperturas(f), lim = num(S.cfg.limite) || 15;
  return card('progreso', 'info', 'Redes hoy', `<div class="row between"><span class="big-num ${n > lim ? 'mal' : ''}">${n}<small> / ${lim}</small></span>
    <span class="row">${S.cfg.apps.map(a => `<button class="sm" data-a="abrir" data-v="${esc(a)}" aria-label="Sumar apertura de ${esc(a)}">${esc(a)} +1</button>`).join('')}</span></div>
    <p class="muted small" style="margin:8px 0 0">${n > lim ? 'Pasaste tu límite: mañana resta XP de Enfoque.' : 'Quedarte bajo el límite da XP de Enfoque cada día.'}</p>`);
}
function jefeCard(compacto) {
  const j = jefe();
  const body = `<p class="big jefe-n">${esc(j.nombre)}</p>
    <ul class="metas">${j.metas.map(m => `<li class="${m.ok ? 'ok' : ''}"><span>${m.ok ? '✓' : '○'} ${esc(m.t)}</span><b>${m.v}${m.cap ? '' : '/' + m.n}</b></li>`).join('')}</ul>
    ${j.derrotado ? '<p class="ok">Derrotado esta semana.</p>' : j.listo ? `<button class="pri scarlet" style="width:100%" data-a="jefe">Derrotar al jefe · +150 XP</button>` : `<p class="muted small">${j.metas.some(m => m.cap) ? 'La meta de redes se cumple el fin de semana si sigues bajo el número.' : 'Cumple las 4 metas antes del domingo.'}</p>`}`;
  return card('progreso', compacto ? 'info' : 'mision', 'Jefe de la semana', body, j.derrotado ? chip('Vencido', true) : '');
}
function escudoCard() {
  const n = rachaRota();
  if (!n) return '';
  const e = escudosDisp();
  return card('lectura', 'mision', 'Tu racha se cortó ayer', `<p>Tenías <b>${n} días</b> seguidos leyendo. Un escudo la salva.</p>
    ${e > 0 ? `<button class="pri" data-a="escudo">Usar escudo (te quedan ${e})</button>` : `<button data-a="ir" data-v="progreso:tienda">Comprar escudo · 100 XP</button>`}`);
}
function minimoCard() {
  if (cubierto(hoy())) return '';
  const it = [['m1', 'Lee 1 página'], ['m2', 'Toma 1 vaso de agua'], ['m3', 'Haz 1 repaso o lee 1 concepto']];
  if (!ui.minimoAbierto) return `<button class="link-btn" data-a="minimo-abrir">¿Día malo? Haz el día mínimo y salva tus rachas</button>`;
  return card('lectura', 'mision', 'Día mínimo', `<p class="muted">Tres cosas pequeñas. Mantienen vivas todas tus rachas de hoy.</p>
    <ul class="checks">${it.map(([k, t]) => `<li><button data-a="minimo" data-v="${k}" class="${ui.minimo[k] ? 'on' : ''}">${ui.minimo[k] ? '✓' : ''}</button>${t}</li>`).join('')}</ul>`);
}
function hechoHoy() {
  const f = hoy(), l = [];
  const pg = paginasDia(f), meta = num(S.cfg.meta) || 10;
  if (pg >= meta) l.push(`Lectura · ${pg} páginas`);
  const r = S.social.find(x => x.Fecha === f && x.Hecho === 'sí'); if (r) l.push('Reto social');
  if (vasos(f) >= 8) l.push('8 vasos de agua');
  if (notaDe(f, 'ritual')) l.push('Ritual nocturno');
  if (notaDe(f, 'dia')) l.push('Nota del día');
  const mis = S.xp.filter(x => dia(x) === f && String(x.Motivo).startsWith('aburrido:')).length; if (mis) l.push(plural(mis, 'misión', 'misiones'));
  const enf = S.enfoque.filter(x => dia(x) === f).length; if (enf) l.push(plural(enf, 'bloque de enfoque', 'bloques de enfoque'));
  if (cubierto(f)) l.push('Día mínimo');
  const xpHoy = S.xp.filter(x => dia(x) === f).reduce((t, x) => t + num(x.Puntos), 0);
  if (!l.length && !xpHoy) return '';
  return card('hoy', 'info', 'Hecho hoy', `<p class="hecho">${l.map(x => `<span>✓ ${x}</span>`).join('')}</p><p class="muted small">+${xpHoy} XP hoy${comboHoy() ? ' · combo activo ×1,5' : ''}</p>`);
}

/* ---------- gráficos del tablero ---------- */
function radar() {
  const vals = ATTR.map(attrNivel), max = Math.max(5, ...vals);
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [150 + r * Math.cos(a), 120 + r * Math.sin(a)]; };
  const ring = k => ATTR.map((_, i) => pt(i, 90 * k).join(',')).join(' ');
  const poly = vals.map((v, i) => pt(i, 90 * v / max).join(',')).join(' ');
  return `<svg viewBox="0 0 300 245" class="chart" role="img" aria-label="Niveles por atributo: ${ATTR.map((a, i) => a + ' ' + vals[i]).join(', ')}">
    ${[0.25, 0.5, 0.75, 1].map(k => `<polygon points="${ring(k)}" fill="none" stroke="var(--line)"/>`).join('')}
    ${ATTR.map((_, i) => { const [x, y] = pt(i, 90); return `<line x1="150" y1="120" x2="${x}" y2="${y}" stroke="var(--line)"/>`; }).join('')}
    <polygon points="${poly}" fill="var(--gold)" fill-opacity=".22" stroke="var(--gold2)" stroke-width="2"/>
    ${ATTR.map((a, i) => { const [x, y] = pt(i, 108); return `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="var(--text)">${a} ${vals[i]}</text>`; }).join('')}
  </svg>`;
}
function heatmap() {
  const sem = 26, fin = hoy(), ini = addDays(lunes(fin), -7 * (sem - 1));
  const por = {}; S.xp.forEach(r => { const d = dia(r); if (num(r.Puntos) > 0) por[d] = (por[d] || 0) + num(r.Puntos); });
  const max = Math.max(30, ...Object.values(por));
  let cells = '';
  for (let w = 0; w < sem; w++) for (let d = 0; d < 7; d++) {
    const f = addDays(ini, w * 7 + d); if (f > fin) continue;
    const v = por[f] || 0, o = v ? 0.2 + 0.8 * Math.min(1, v / max) : 0;
    cells += `<rect x="${w * 12}" y="${d * 12}" width="10" height="10" rx="2" fill="${v ? 'var(--gold)' : 'var(--card2)'}" fill-opacity="${v ? o.toFixed(2) : 1}"><title>${f}: ${v} XP</title></rect>`;
  }
  return `<svg viewBox="0 0 ${sem * 12} 84" class="chart" role="img" aria-label="XP por día en las últimas 26 semanas">${cells}</svg>`;
}
function barras(vals, labels, color, unidad) {
  const max = Math.max(1, ...vals), w = 300 / vals.length;
  return `<svg viewBox="0 0 300 120" class="chart" role="img" aria-label="${labels.map((l, i) => l + ': ' + vals[i] + ' ' + unidad).join(', ')}">
    ${vals.map((v, i) => { const h = Math.round(80 * v / max); return `<rect x="${i * w + 4}" y="${92 - h}" width="${w - 8}" height="${h}" rx="3" fill="${color}"/><text x="${i * w + w / 2}" y="${88 - h}" text-anchor="middle" font-size="10" fill="var(--text)">${v}</text><text x="${i * w + w / 2}" y="110" text-anchor="middle" font-size="9.5" fill="var(--muted)">${labels[i]}</text>`; }).join('')}
  </svg>`;
}
function semanas(n) {
  const l0 = lunes(hoy());
  return Array.from({ length: n }, (_, i) => addDays(l0, -7 * (n - 1 - i)));
}
const enSemana = (lun, f) => f >= lun && f <= addDays(lun, 6);
function energiaInsight() {
  const dias = S.notas.filter(r => r.Tipo === 'dia' && num(r['Energía'])).map(r => ({ f: r['Fecha y hora'], e: num(r['Energía']) }));
  if (dias.length < 5) return `<p class="muted">Anota tu energía en la nota del día durante al menos 5 días y aquí verás con qué se relaciona.</p>`;
  const prom = a => a.length ? (a.reduce((t, x) => t + x.e, 0) / a.length).toFixed(1) : '–';
  const lim = num(S.cfg.limite) || 15;
  const sueñoBien = dias.filter(d => num((saludDe(d.f) || {})['Sueño']) >= 7), sueñoMal = dias.filter(d => { const s = num((saludDe(d.f) || {})['Sueño']); return s > 0 && s < 7; });
  const redesBien = dias.filter(d => aperturas(d.f) <= lim), redesMal = dias.filter(d => aperturas(d.f) > lim);
  const mov = dias.filter(d => S.xp.some(r => dia(r) === d.f && r.Atributo === 'Fuerza' && num(r.Puntos) > 0)), sinMov = dias.filter(d => !mov.includes(d));
  return `<table><tr><th></th><th>Energía promedio</th></tr>
    ${sueñoBien.length || sueñoMal.length ? `<tr><td>Días con 7 h o más de sueño</td><td>${prom(sueñoBien)}</td></tr><tr><td>Días con menos de 7 h</td><td>${prom(sueñoMal)}</td></tr>` : ''}
    <tr><td>Días bajo el límite de redes</td><td>${prom(redesBien)}</td></tr><tr><td>Días sobre el límite</td><td>${prom(redesMal)}</td></tr>
    <tr><td>Días con algo de cuerpo</td><td>${prom(mov)}</td></tr><tr><td>Días sin moverte</td><td>${prom(sinMov)}</td></tr></table>`;
}
function revisionMes(desplaza) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - desplaza);
  const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const p = new Date(d); p.setMonth(p.getMonth() - 1); const ymP = `${p.getFullYear()}-${pad(p.getMonth() + 1)}`;
  const enM = (r, m) => dia(r).slice(0, 7) === m;
  const xpA = a => S.xp.filter(r => enM(r, ym) && r.Atributo === a).reduce((t, r) => t + num(r.Puntos), 0);
  const tot = m => S.xp.filter(r => enM(r, m)).reduce((t, r) => t + num(r.Puntos), 0);
  const pags = S.lectura.filter(r => String(r.Fecha).slice(0, 7) === ym).reduce((t, r) => t + num(r['Páginas']), 0);
  const redes = S.redes.filter(r => enM(r, ym)).length, redesP = S.redes.filter(r => enM(r, ymP)).length;
  const logros = S.xp.filter(r => enM(r, ym) && String(r.Motivo).startsWith('logro:'));
  const vic = S.notas.filter(r => r.Tipo === 'victoria' && enM(r, ym));
  const mejor = [...ATTR].sort((a, b) => xpA(b) - xpA(a))[0];
  let rachaMax = 0, c = 0; const set = new Set(diasLectura());
  const nd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  for (let i = 1; i <= nd; i++) { const f = `${ym}-${pad(i)}`; if (set.has(f) || cubierto(f)) { c++; rachaMax = Math.max(rachaMax, c); } else c = 0; }
  const nombre = d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  return card('progreso', 'registro', `Revisión de ${nombre}`, `<div class="tiles"><div class="tile"><b>${tot(ym)}</b><span>XP (${tot(ymP)} el mes anterior)</span></div><div class="tile"><b>${pags}</b><span>páginas</span></div><div class="tile"><b>${rachaMax}</b><span>mejor racha</span></div></div>
    <p>Lo que más creció: <b>${xpA(mejor) ? mejor : '—'}</b>. Aperturas de redes: ${redes}${redesP ? ` (${redes <= redesP ? 'bajaron' : 'subieron'} desde ${redesP})` : ''}.</p>
    ${logros.length ? `<p class="muted">Logros: ${logros.map(r => esc(r.Detalle)).join(' · ')}</p>` : ''}
    ${vic.length ? `<h3>Victorias</h3><ul class="list">${vic.slice(-6).map(v => `<li>${esc(v.Texto)}</li>`).join('')}</ul>` : ''}`);
}

/* ---------- pantallas ---------- */
const V = {
  hoy() {
    const f = fraseHoy(), timer = S.timer && enfoqueRestante() > 0 ? `<button class="timer-chip" data-a="tab" data-v="clases">Enfoque · ${fmtMin(enfoqueRestante())}</button>` : '';
    const hora = new Date().getHours(), dom = new Date().getDay() === 0;
    const revMes = new Date().getDate() <= 5 && S.xp.some(r => dia(r).slice(0, 7) !== hoy().slice(0, 7));
    const rep = repasosPend().length;
    return `${hero('hoy')}${header('BEST<b>LX</b>', new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))}
      <div class="row center" style="margin:-8px 0 16px">${rangoMini()}${timer}</div>
      ${escudoCard()}
      ${abCard()}
      ${card('hoy', 'info', 'Frase del día', `<blockquote class="frase" lang="${f ? f.l : 'es'}">${f ? esc(f.t) : '…'}</blockquote>${f ? chip(esc(f.tema)) : ''}`)}
      ${clasesCard()}
      ${rep ? card('mis', 'mision', 'Repasos', `<div class="row between"><span>${plural(rep, 'concepto espera', 'conceptos esperan')} repaso.</span><button class="pri" data-a="ir" data-v="misiones:repaso">Repasar</button></div>`) : ''}
      ${S.social.some(x => x.Fecha === hoy()) ? '' : retoCard()}
      ${paginasDia(hoy()) >= (num(S.cfg.meta) || 10) ? '' : lecturaCard()}
      ${vasos(hoy()) >= 8 ? '' : aguaCard()}
      ${personasCard(true)}
      ${hora >= 19 ? ritualCard() : ''}
      ${jefeCard(true)}
      ${redesInfo()}
      ${dom && !S.pantalla.some(r => r.Semana === lunes(hoy())) ? card('progreso', 'mision', 'Es domingo', '<p>Anota las horas de Tiempo en pantalla de esta semana.</p><button class="sm" data-a="ir" data-v="progreso:tablero">Anotar ahora</button>') : ''}
      ${revMes ? `<button class="link-btn" data-a="ir" data-v="progreso:tablero">Tu revisión del mes pasado está lista →</button>` : ''}
      ${minimoCard()}
      ${hechoHoy()}`;
  },
  clases() {
    const todas = tareas(), p = pendientes(), lista = ui.verHechas ? todas : p;
    const grupos = [['Vencidas', r => r.h <= 0 && !r.done], ['Hoy y mañana', r => r.h > 0 && r.h <= 48], ['Esta semana', r => r.h > 48 && r.h <= 24 * 7], ['Después', r => r.h > 24 * 7], ['Entregadas', r => r.done && r.h <= 0]];
    const alta = p.filter(r => r.Prioridad === 'Alta').length, pesoSemana = p.filter(r => r.h <= 24 * 7).reduce((t, r) => t + num(r.Peso), 0);
    let cuerpo;
    if (!S.cfg.url) cuerpo = card('clases', 'info', '', `<p class="muted">Conecta primero tu Sheet en <b>Progreso › Ajustes</b>. Canvas llega por ahí.</p>`);
    else if (!S.canvas.length) cuerpo = card('clases', 'info', '', `<p class="muted">Todavía no hay datos de Canvas. Pon <code>CANVAS_URL</code> y <code>CANVAS_TOKEN</code> en las Propiedades del script y toca Sincronizar.</p>`);
    else cuerpo = grupos.map(([t, fn]) => { const g = lista.filter(fn); return g.length ? card('clases', 'registro', t, `<ul class="list">${g.map(tareaItem).join('')}</ul>`) : ''; }).join('') || card('clases', 'info', '', '<p class="muted">Nada pendiente. Buen momento para leer.</p>');
    const pr = pruebasProximas(7);
    return `${hero('clases')}${header('Clases', S.canvas.length ? `Canvas · actualizado ${actualizadoCanvas()}` : 'Canvas')}
      <div class="tiles"><div class="tile"><b>${p.length}</b><span>pendientes</span></div><div class="tile"><b>${alta}</b><span>prioridad alta</span></div><div class="tile"><b>${Math.round(pesoSemana)}%</b><span>de nota esta semana</span></div></div>
      ${enfoqueCard()}
      ${pr.length ? card('clases', 'mision', 'Modo prueba', `<ul class="list">${pr.map(r => `<li><b>${esc(r.Materia)}</b> · ${esc(r['Título'])}<small>${cuando(r)} · ${num(r.Peso)}% de la nota</small><button class="sm" style="margin-top:6px" data-a="copiar" data-v="${esc(promptPrueba(r))}">Copiar prompt para estudiar con Claude</button></li>`).join('')}</ul>`) : ''}
      <div class="row" style="margin-bottom:14px"><button class="grow" data-a="canvas-sync">Sincronizar Canvas</button><button class="ghost" data-a="ver-hechas">${ui.verHechas ? 'Ocultar entregadas' : 'Ver entregadas'}</button></div>
      ${cuerpo}`;
  },
  misiones() {
    const s = ui.sub.misiones;
    const nav = subnav('misiones', [['aburrido', 'Aburrido', 'mis'], ['ventas', 'Ventas', 'mis'], ['simulador', 'Simulador', 'mis'], ['negocios', 'Negocios', 'mis'], ['casos', 'Casos', 'mis'], ['cuarenta', 'Cuarenta', 'mis'], ['tech', 'Go y redes', 'mis'], ['ingles', 'Inglés', 'mis'], ['repaso', `Repaso${repasosPend().length ? ' · ' + repasosPend().length : ''}`, 'mis'], ['biblioteca', 'Biblioteca', 'mis']]);
    return `${hero('mis')}${header('Misiones', 'Aprender en vez de scroll')}${nav}${(MIS[s] || MIS.aburrido)()}`;
  },
  diario() {
    const s = ui.sub.diario;
    const nav = subnav('diario', [['lectura', 'Lectura', 'lectura'], ['social', 'Social', 'social'], ['cuerpo', 'Cuerpo', 'cuerpo'], ['notas', 'Notas', 'notas']]);
    return `${hero('diario')}${header('Diario', { lectura: 'Lectura', social: 'Social', cuerpo: 'Cuerpo', notas: 'Notas' }[s])}${nav}${(DIA[s] || DIA.lectura)()}`;
  },
  progreso() {
    const s = ui.sub.progreso;
    const nav = subnav('progreso', [['nivel', 'Nivel', 'progreso'], ['tienda', 'Tienda', 'progreso'], ['tablero', 'Tablero', 'progreso'], ['ajustes', 'Ajustes', 'progreso']]);
    return `${hero('progreso')}${header('Progreso', RANGOS[rangoIdx(xpTotal())].n)}${nav}${(PRO[s] || PRO.nivel)()}`;
  }
};

/* Misiones */
const MIS = {
  aburrido() {
    const n = startsMot('aburrido:').length;
    return `${abCard()}${card('mis', 'info', 'Cómo funciona', `<p class="muted">Eliges dónde estás y cuánto tiempo tienes, y te doy una misión que se pueda hacer ahí. Cada misión da su XP más +5 de Enfoque por elegirla en vez del scroll. Puedes saltar hasta 2.</p><p class="muted small">Llevas ${plural(n, 'misión completada', 'misiones completadas')}.</p>`)}`;
  },
  ventas() {
    const it = conceptoDelDia('ventas');
    const vistos = D.ap.ventas.filter(x => repasoDe(x.id));
    const bloq = D.ap.ventas.filter(x => x.adv).length;
    const guiones = S.notas.filter(r => r.Tipo === 'guion');
    const g = t => guiones.filter(r => r.Etiqueta === t);
    return `${card('mis', 'mision', 'Concepto de ventas', itemBody('ventas', it, 'modulo'), chip(`${vistos.length}/${D.ap.ventas.length}`))}
      ${!espartano() ? card('mis', 'info', '', `<p class="muted small">🔒 ${bloq} conceptos avanzados se desbloquean al llegar a Espartano.</p>`) : ''}
      ${card('mis', 'registro', 'Mis guiones', `<p class="muted">Tus mejores frases para llamadas. Escríbelas con tus palabras.</p>
        <div class="seg">${[['apertura', 'Apertura'], ['objecion', 'Objeciones'], ['cierre', 'Cierre']].map(([k, t]) => `<button data-a="guion-tipo" data-v="${k}" class="${ui.guionTipo === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <textarea id="g-t" data-draft="g-t" placeholder="Ej.: Te llamo porque vi tu local y tengo una idea para tus redes. ¿Tienes 2 minutos?">${esc(draft('g-t'))}</textarea>
        <button class="pri" style="margin-top:10px" data-a="guion-add">Guardar guion</button>
        ${['apertura', 'objecion', 'cierre'].map(k => g(k).length ? `<h3>${{ apertura: 'Apertura', objecion: 'Objeciones', cierre: 'Cierre' }[k]}</h3><ul class="list">${g(k).map(r => `<li>${esc(r.Texto)}</li>`).join('')}</ul>` : '').join('')}`)}
      ${vistos.length ? card('mis', 'info', 'Ya aprendiste', `<ul class="list">${vistos.map(x => `<li>${esc(x.t)}</li>`).join('')}</ul><button class="sm ghost" data-a="ir" data-v="misiones:biblioteca">Ver en la biblioteca</button>`) : ''}`;
  },
  simulador() {
    if (!ui.simId || !D.ap.objeciones.find(x => x.id === ui.simId)) ui.simId = (D.ap.objeciones[rnd(D.ap.objeciones.length)] || {}).id;
    const it = D.ap.objeciones.find(x => x.id === ui.simId);
    return `${card('mis', 'mision', 'Simulador de llamada', itemBody('sim', it, 'modulo'), xpChip(8))}
      <button class="ghost" style="width:100%" data-a="sim-nuevo">Otro cliente</button>
      ${card('mis', 'info', 'Cómo practicar', '<p class="muted">Lee la objeción, responde en voz alta como si fuera una llamada real y recién después mira la respuesta modelo. Fíjate en si escuchaste, preguntaste la duda real y propusiste un siguiente paso.</p>')}`;
  },
  negocios() {
    const it = conceptoDelDia('negocios');
    const vistos = D.ap.negocios.filter(x => repasoDe(x.id));
    return `${card('mis', 'mision', 'Concepto de negocios e inversión', itemBody('negocios', it, 'modulo'), chip(`${vistos.length}/${D.ap.negocios.length}`))}
      ${vistos.length ? card('mis', 'info', 'Ya aprendiste', `<ul class="list">${vistos.map(x => `<li>${esc(x.t)}</li>`).join('')}</ul>`) : ''}`;
  },
  casos() {
    const pend = D.ap.casos.filter(x => !hasMot('caso:' + x.id));
    const it = pend[0] || D.ap.casos[dayNum(hoy()) % (D.ap.casos.length || 1)];
    return `${card('mis', 'mision', 'Caso de negocio', itemBody('caso', it, 'modulo'), chip(`${D.ap.casos.length - pend.length}/${D.ap.casos.length}`))}`;
  },
  cuarenta() {
    const g = ui.c40, nv = num(S.c40.nivel) || 1;
    let body;
    if (!g) body = `<p>Salen cartas una a una, como en una mano de Cuarenta. Cuéntalas en la cabeza y luego responde 3 preguntas sobre lo que queda.</p>
      <p class="muted">Nivel ${nv}: ${Math.min(30, 6 + 2 * nv)} cartas, ${(Math.max(550, 1400 - 100 * nv) / 1000).toFixed(1)} s cada una. 3 de 3 te sube de nivel; 1 o menos te baja.</p>
      <button class="pri xl" data-a="c40-ir" data-v="modulo">Empezar ronda</button>`;
    else if (g.fase === 'mostrando') { const c = g.cartas[g.i]; body = `<div class="naipe ${c.col}" aria-live="assertive"><span>${c.r}</span><span class="palo">${c.p}</span></div><p class="muted center">Carta ${g.i + 1} de ${g.cartas.length}</p>`; }
    else if (g.fase === 'pregunta') { const p = g.pregs[g.k]; body = `${g.ultima ? `<p class="${g.ultima.bien ? 'ok' : 'mal'}">${g.ultima.bien ? '✓ Correcto' : '✗ Eran ' + g.ultima.r}</p>` : ''}<p class="big">${p.t}</p><div class="rate">${p.op.map(o => `<button data-a="c40-r" data-v="${o}">${o}</button>`).join('')}</div><p class="muted small">Pregunta ${g.k + 1} de 3</p>`; }
    else body = `${g.ultima ? `<p class="${g.ultima.bien ? 'ok' : 'mal'}">${g.ultima.bien ? '✓ Correcto' : '✗ Eran ' + g.ultima.r}</p>` : ''}<p class="big">${g.ok} de 3</p><p class="muted">${g.ok === 3 ? `Subes al nivel ${g.nv + 1}.` : g.ok <= 1 ? 'Bajas un nivel para afinar.' : 'Te quedas en este nivel.'}</p><div class="row"><button class="pri grow" data-a="c40-ir" data-v="modulo">Otra ronda</button><button class="ghost" data-a="c40-salir">Salir</button></div>`;
    return `${card('mis', 'mision', 'Entrenador de Cuarenta', body, chip('Nivel ' + nv))}${card('mis', 'info', '', `<p class="muted small">Mejor ronda perfecta: nivel ${num(S.c40.mejor) || '—'}. El mazo tiene 40 cartas: A, 2–7, J, Q y K de cada palo.</p>`)}`;
  },
  tech() {
    const nv = Math.min(3, 1 + Math.floor(rangoIdx(xpTotal()) / 2));
    const areas = ['Go', 'Redes', 'Ciber'];
    return areas.map(a => {
      const l = D.ap.tech.filter(x => x.area === a);
      const sig = l.find(x => x.n <= nv && !hasMot('tech:' + x.id));
      return card('mis', sig ? 'mision' : 'info', a === 'Ciber' ? 'Ciberseguridad' : a, `${sig ? itemBody('tech', sig, 'modulo') : '<p class="muted">Completaste los retos de tu nivel. Sube de rango para desbloquear más.</p>'}
        <details><summary>Todos los retos (${l.filter(x => hasMot('tech:' + x.id)).length}/${l.length})</summary><ul class="list">${l.map(x => `<li>${hasMot('tech:' + x.id) ? '✓' : x.n > nv ? '🔒' : '○'} ${esc(x.r)}<small>nivel ${x.n}</small></li>`).join('')}</ul></details>`);
    }).join('');
  },
  ingles() {
    const it = D.ap.ingles.length ? (D.ap.ingles.filter(x => !repasoDe(x.id))[0] || D.ap.ingles[dayNum(hoy()) % D.ap.ingles.length]) : null;
    return `${card('mis', 'mision', 'Inglés para vender', itemBody('ingles', it, 'modulo'))}
      ${card('mis', 'info', 'Todas las frases', `<ul class="list">${D.ap.ingles.map(x => `<li lang="en">${repasoDe(x.id) ? '✓ ' : ''}${esc(x.en)}<small>${esc(x.es)} · ${esc(x.uso)}</small></li>`).join('')}</ul>`)}`;
  },
  repaso() {
    const p = repasosPend();
    if (!p.length) return card('mis', 'info', 'Repaso', `<p class="muted">No hay repasos pendientes. Cada concepto o frase que aprendes vuelve al día 1, al 3 y al 7.</p><p class="muted small">${plural(dominados().length, 'concepto dominado', 'conceptos dominados')}.</p>`);
    const r = p[0], it = itemPorId(r.ID), rev = ui.rep[r.ID];
    return card('mis', 'mision', 'Repaso', `<p class="muted small">${p.length} pendientes · paso ${num(r.Paso) + 1} de 3</p>
      <p class="big" ${it && it.en ? 'lang="en"' : ''}>${esc(titulo(it))}</p>
      ${rev ? `<p class="pre">${esc(explic(it))}</p><div class="row"><button class="pri grow" data-a="rep-ok" data-v="${r.ID}">Lo sabía</button><button class="grow" data-a="rep-no" data-v="${r.ID}">No lo recordaba</button></div>` : `<p class="muted">¿Lo recuerdas? Explícalo en tu cabeza y luego revisa.</p><button class="pri" data-a="rep-ver" data-v="${r.ID}">Mostrar</button>`}`, xpChip(3));
  },
  biblioteca() {
    const q = ui.biblioBusca.toLowerCase();
    const l = S.repaso.map(r => ({ r, it: itemPorId(r.ID) })).filter(x => x.it && (!q || (titulo(x.it) + ' ' + explic(x.it)).toLowerCase().includes(q)));
    return card('mis', 'info', 'Biblioteca', `<input data-draft="biblio" data-live="biblioBusca" placeholder="Buscar en lo que aprendiste" value="${esc(ui.biblioBusca)}">
      ${l.length ? `<ul class="list">${l.map(({ r, it }) => `<li><details><summary>${num(r.Paso) >= 3 ? '★ ' : ''}${esc(titulo(it))}</summary><p class="pre">${esc(explic(it))}</p></details></li>`).join('')}</ul>` : '<p class="muted" style="margin-top:10px">Aquí se guarda todo lo que aprendes en Ventas, Negocios e Inglés.</p>'}
      <p class="muted small">★ = dominado (3 repasos seguidos).</p>`);
  }
};

/* Diario */
const DIA = {
  lectura() {
    const b = libroActual(), hist = [...S.lectura].sort((a, c) => c.Fecha.localeCompare(a.Fecha)).slice(0, 10), fin = S.libros.filter(x => x.Fin).reverse();
    const sem = Array.from({ length: 7 }, (_, i) => addDays(lunes(hoy()), i)).reduce((t, f) => t + paginasDia(f), 0);
    return `<div class="tiles" style="--acc:var(--c-lectura)"><div class="tile"><b>${rachaLectura()}</b><span>días de racha</span></div><div class="tile"><b>${sem}</b><span>págs esta semana</span></div><div class="tile"><b>${fin.length}</b><span>libros terminados</span></div></div>
      ${escudoCard()}${lecturaCard()}
      ${b && ui.form !== 'libro' ? `<div class="row" style="margin-bottom:14px"><button class="grow" data-a="libro-fin">Terminé este libro</button><button class="grow" data-a="libro-cambiar">Cambiar de libro</button></div>` : ''}
      ${hist.length ? card('lectura', 'info', 'Últimos días', `<ul class="list">${hist.map(r => `<li>${num(r['Páginas'])} páginas<small>${corta(r.Fecha)} · ${esc(r.Libro)}</small></li>`).join('')}</ul>`) : ''}
      ${fin.length ? card('lectura', 'info', 'Terminados', `<ul class="list">${fin.map(x => `<li>${esc(x.Libro)}<small>${esc(x.Autor || '')} · ${esc(x.Inicio)} a ${esc(x.Fin)}</small></li>`).join('')}</ul>`) : ''}`;
  },
  social() {
    const n = nivel(), hist = [...S.social].sort((a, c) => c.Fecha.localeCompare(a.Fecha)).slice(0, 12);
    return `${card('social', 'info', 'Tu nivel social', `<div class="row between"><p class="big" style="margin:0">${NIVELES[n.l - 1]}</p>${chip(`Nivel ${n.l} de 5`, true)}</div>
        <div class="dots">${[0, 1, 2, 3, 4].map(i => `<i class="${i < n.c ? 'on' : ''}"></i>`).join('')}</div>
        <p class="muted" style="margin:8px 0 0">${n.l === 5 && n.c >= 5 ? 'Completaste todos los niveles.' : `${n.c} de 5 retos para subir · racha de ${rachaSocial()} días`}</p>`)}
      ${retoCard()}${personasCard(false)}${preguntasCard()}
      ${hist.length ? card('social', 'info', 'Historial', `<ul class="list">${hist.map(r => `<li>${r.Hecho === 'sí' ? '✓' : '–'} ${esc(r.Reto)}<small>${corta(r.Fecha)} · nivel ${num(r.Nivel)}${num(r['Cómo te fue']) ? ` · ${num(r['Cómo te fue'])}/5` : ''}${r.Nota ? ' · ' + esc(r.Nota) : ''}</small></li>`).join('')}</ul>`) : ''}`;
  },
  cuerpo() {
    const s = saludDe(hoy()) || {}, ayer = saludDe(addDays(hoy(), -1)) || {};
    return `${aguaCard()}
      ${card('cuerpo', 'registro', 'Pasos y sueño', `<p class="muted">El Atajo nocturno los trae de la app Salud. Si no lo configuraste, anótalos aquí.</p>
        <div class="row"><div class="grow"><label for="s-p">Pasos de hoy</label><input id="s-p" type="number" inputmode="numeric" min="0" value="${num(s.Pasos) || ''}"></div>
        <div class="grow"><label for="s-s">Horas que dormiste</label><input id="s-s" type="number" inputmode="decimal" step="0.5" min="0" value="${num(s['Sueño']) || ''}"></div></div>
        <button class="pri" style="width:100%;margin-top:12px" data-a="salud">Guardar</button>
        ${num(ayer.Pasos) || num(ayer['Sueño']) ? `<p class="muted small" style="margin-top:10px">Ayer: ${num(ayer.Pasos) || '—'} pasos · ${num(ayer['Sueño']) || '—'} h de sueño</p>` : ''}`, chip('8.000 pasos · 7 h'))}
      ${D.ap.rutinas.map(r => card('cuerpo', 'mision', r.nombre, `<ol class="ejs">${r.ej.map(e => `<li>${esc(e)}</li>`).join('')}</ol><button class="pri" data-a="rutina" data-v="${r.id}">Terminé la rutina</button>`, chip(`${r.min} min`) + ' ' + xpChip(r.min >= 20 ? 25 : 15))).join('')}
      ${card('cuerpo', 'info', 'Estirar', '<p class="muted">Después de 50 minutos de enfoque seguidos, la app te sugiere 2 minutos de estiramiento.</p>')}`;
  },
  notas() {
    const f = hoy(), dn = notaDe(f, 'dia');
    const filtro = ui.notaFiltro, q = ui.notaBusca.toLowerCase();
    const tipos = { todas: 'Todas', dia: 'Del día', ritual: 'Ritual', rapida: 'Rápidas', victoria: 'Victorias', carta: 'Cartas' };
    const lista = S.notas.filter(r => r.Tipo !== 'guion' && (filtro === 'todas' || r.Tipo === filtro) && (!q || String(r.Texto).toLowerCase().includes(q))).sort((a, b) => String(b['Fecha y hora']).localeCompare(String(a['Fecha y hora']))).slice(0, 40);
    const en = dn ? num(dn['Energía']) : ui.energia;
    return `${card('notas', dn ? 'registro' : 'mision', 'Nota del día', `<label for="nd">¿Cómo fue tu día?</label><textarea id="nd" data-draft="nd">${esc(draft('nd', dn ? dn.Texto : ''))}</textarea>
        <label>Energía</label><div class="rate">${[1, 2, 3, 4, 5].map(n => `<button data-a="energia" data-v="${n}" class="${en === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <button class="pri" style="width:100%;margin-top:10px" data-a="nota-dia">${dn ? 'Actualizar' : 'Guardar'}</button>`, dn ? chip('Guardada', true) : xpChip(5))}
      ${ritualCard() || card('notas', 'info', 'Ritual de hoy', `<p class="pre">${esc(notaDe(f, 'ritual').Texto)}</p>`)}
      ${card('notas', 'registro', 'Nota rápida', `<div class="seg">${['idea', 'negocio', 'U', 'personal'].map(t => `<button data-a="etiqueta" data-v="${t}" class="${ui.etiqueta === t ? 'on' : ''}">${t}</button>`).join('')}</div>
        <textarea id="nr" data-draft="nr" placeholder="Escribe sin pensarlo mucho">${esc(draft('nr'))}</textarea><button class="pri" style="margin-top:10px" data-a="nota-rapida">Guardar</button>`)}
      ${card('notas', 'registro', 'Victoria', `<p class="muted">Un logro pequeño y real de hoy. Para leerlo en un día bajo.</p><input id="vc" data-draft="vc" value="${esc(draft('vc'))}" placeholder="Hoy…"><button class="pri" style="margin-top:10px" data-a="victoria">Guardar victoria</button>`, xpChip(3))}
      ${card('notas', 'registro', 'Carta a tu yo del futuro', `<textarea id="ct" data-draft="ct" placeholder="Querido Luis del futuro…">${esc(draft('ct'))}</textarea>
        <div class="row" style="margin-top:10px"><span class="muted">Se abre en</span><div class="seg" style="margin:0">${[3, 6].map(m => `<button data-a="carta-m" data-v="${m}" class="${ui.carta === m ? 'on' : ''}">${m} meses</button>`).join('')}</div></div>
        <button class="pri" style="margin-top:10px" data-a="carta">Sellar carta</button>`)}
      ${card('notas', 'info', 'Tus notas', `<input data-live="notaBusca" placeholder="Buscar" value="${esc(ui.notaBusca)}">
        <div class="chips" style="margin-top:10px">${Object.keys(tipos).map(k => `<button data-a="nota-filtro" data-v="${k}" class="${filtro === k ? 'on' : ''}">${tipos[k]}</button>`).join('')}</div>
        ${lista.length ? `<ul class="list">${lista.map(r => {
          const sell = r.Tipo === 'carta' && String(r.Abre) > f;
          return `<li>${sell ? `🔒 Carta sellada<small>se abre el ${corta(String(r.Abre))}</small>` : `<span class="pre">${esc(r.Texto)}</span><small>${esc(tipos[r.Tipo] || r.Tipo)}${r.Etiqueta ? ' · ' + esc(r.Etiqueta) : ''}${num(r['Energía']) ? ' · energía ' + num(r['Energía']) : ''} · ${corta(dia(r))}</small>`}</li>`;
        }).join('')}</ul>` : '<p class="muted">Todavía no hay notas aquí.</p>'}`)}`;
  }
};

/* Progreso */
const PRO = {
  nivel() {
    const xp = xpTotal(), i = rangoIdx(xp), sig = RANGOS[i + 1], t = temporada();
    const pct = sig ? Math.round((xp - RANGOS[i].xp) / (sig.xp - RANGOS[i].xp) * 100) : 100;
    const logros = LOGROS.map(l => ({ l, ok: hasMot('logro:' + l.id) }));
    return `${card('progreso', 'info', 'Tu rango', `<div class="rango-big"><span class="rango-n">${RANGOS[i].n}</span><span class="muted">${xp} XP${sig ? ` · ${sig.xp - xp} para ${sig.n}` : ' · rango máximo'}</span></div>
        <div class="bar gold"><i style="width:${pct}%"></i></div>
        <div class="rangos">${RANGOS.map((r, k) => `<span class="${k <= i ? 'on' : ''} ${k === 5 ? 'god' : ''}">${r.n}</span>`).join('')}</div>`)}
      ${card('progreso', 'info', 'Atributos', ATTR.map(a => { const x = attrXP(a), l = attrNivel(a), base = 20 * (l - 1) ** 2, next = 20 * l ** 2; return `<div class="attr" style="--ac:${ATTR_COLOR[a]}"><div class="row between"><b>${a}</b><span class="muted">nivel ${l} · ${x} XP</span></div><div class="bar"><i style="width:${Math.round((x - base) / (next - base) * 100)}%"></i></div></div>`; }).join(''))}
      ${card('progreso', 'info', TEMP_NOMBRE[t], `<p class="muted">Este mes, todo lo que sube <b>${t}</b> da XP doble.</p>`)}
      ${jefeCard(false)}
      ${card('progreso', 'info', 'Logros', `<p class="muted small">${logros.filter(x => x.ok).length} de ${LOGROS.length} · cada uno da 25 XP</p><div class="logros">${logros.map(({ l, ok }) => `<div class="logro ${ok ? 'on' : ''}"><span>${ok ? '★' : '🔒'}</span>${esc(l.n)}</div>`).join('')}</div>`)}
      ${card('progreso', 'info', 'Últimos movimientos', `<ul class="list">${[...S.xp].reverse().slice(0, 12).map(r => `<li class="row between"><span>${esc(r.Detalle || r.Motivo.split(':')[0])}<small>${esc(r.Atributo)} · ${esc(String(r['Fecha y hora']).slice(5, 16))}</small></span><b class="${num(r.Puntos) < 0 ? 'mal' : 'ok'}">${num(r.Puntos) > 0 ? '+' : ''}${num(r.Puntos)}</b></li>`).join('') || '<li class="muted">Todavía no ganas XP. Empieza con Estoy aburrido.</li>'}</ul>`)}`;
  },
  tienda() {
    const s = saldo(), e = escudosDisp();
    const premios = S.tienda.length ? S.tienda : [];
    return `${card('progreso', 'info', 'Tu saldo', `<div class="rango-big"><span class="rango-n">${s} XP</span><span class="muted">Gastar XP no te baja de rango.</span></div>`)}
      ${card('progreso', 'mision', 'Escudo de racha', `<p class="muted">Salva una racha de lectura una vez. Tienes ${plural(Math.max(0, e), 'escudo')}.</p><button class="pri" data-a="canje" data-v="Escudo de racha|100">Comprar · 100 XP</button>`)}
      ${card('progreso', 'registro', 'Premios', `${premios.length ? `<ul class="list">${premios.map(p => `<li class="row between"><span>${esc(p.Premio)}<small>${num(p.Costo)} XP</small></span><button class="sm ${s >= num(p.Costo) ? 'pri' : ''}" data-a="canje" data-v="${esc(p.Premio)}|${num(p.Costo)}">Canjear</button></li>`).join('')}</ul>` : '<p class="muted">Define tus premios. Ideas: una partida de PS5 (120 XP), 20 minutos libres de TikTok (80 XP), tu comida favorita (200 XP).</p>'}
        <div class="row" style="margin-top:12px"><input id="t-p" class="grow" placeholder="Premio" autocomplete="off"><input id="t-c" type="number" inputmode="numeric" min="1" placeholder="XP" style="width:90px"><button class="pri" data-a="premio-add">Agregar</button></div>`)}
      ${S.canjes.length ? card('progreso', 'info', 'Canjes', `<ul class="list">${[...S.canjes].reverse().slice(0, 15).map(c => `<li class="row between"><span>${esc(c.Premio)}<small>${esc(String(c['Fecha y hora']).slice(0, 16))}</small></span><b>−${num(c.Costo)}</b></li>`).join('')}</ul>`) : ''}`;
  },
  tablero() {
    const sems = semanas(8), lbl = sems.map(l => l.slice(8) + '/' + l.slice(5, 7));
    const xpS = sems.map(l => S.xp.filter(r => enSemana(l, dia(r)) && num(r.Puntos) > 0).reduce((t, r) => t + num(r.Puntos), 0));
    const redS = sems.map(l => S.redes.filter(r => enSemana(l, dia(r))).length);
    const enfS = sems.map(l => Math.round(S.enfoque.filter(r => enSemana(l, dia(r))).reduce((t, r) => t + num(r.Minutos), 0) / 6) / 10);
    const conS = sems.map(l => S.repaso.filter(r => enSemana(l, String(r.Visto))).length);
    const ini = lunes(hoy()), reg = S.pantalla.find(r => r.Semana === ini), ult = [...S.pantalla].sort((x, y) => y.Semana.localeCompare(x.Semana)).slice(0, 4);
    return `${card('progreso', 'info', 'Tus atributos', radar())}
      ${card('progreso', 'info', 'Tu año en XP', `${heatmap()}<p class="muted small">Últimas 26 semanas. Cada cuadro es un día; más dorado, más XP.</p>`)}
      ${card('progreso', 'info', 'XP por semana', barras(xpS, lbl, 'var(--gold)', 'XP'))}
      ${card('progreso', 'info', 'Aperturas de redes por semana', `${barras(redS, lbl, 'var(--scarlet)', 'aperturas')}<p class="muted small">Si el XP sube y esta baja, las misiones están reemplazando al scroll.</p>`)}
      ${card('progreso', 'info', 'Horas de enfoque por semana', barras(enfS, lbl, 'var(--c-mis)', 'horas'))}
      ${card('progreso', 'info', 'Conceptos aprendidos por semana', barras(conS, lbl, 'var(--c-mis)', 'conceptos'))}
      ${card('progreso', 'info', 'Tu energía', energiaInsight())}
      ${revisionMes(new Date().getDate() <= 5 ? 1 : 0)}
      ${card('progreso', 'registro', 'Tiempo en pantalla', `<p class="muted">Una vez por semana, copia lo que marca Ajustes &gt; Tiempo en pantalla. Semana del ${corta(ini)}.</p>
        <div class="row"><div class="grow"><label for="h-t">Horas totales</label><input id="h-t" type="number" inputmode="decimal" step="0.5" min="0" value="${reg ? esc(reg['Horas totales']) : ''}"></div>
        <div class="grow"><label for="h-r">Horas en redes</label><input id="h-r" type="number" inputmode="decimal" step="0.5" min="0" value="${reg ? esc(reg['Horas en redes']) : ''}"></div></div>
        <button class="pri" style="width:100%;margin-top:12px" data-a="pantalla-guardar">Guardar semana</button>
        ${ult.length ? `<ul class="list" style="margin-top:12px">${ult.map(r => `<li>${num(r['Horas en redes'])} h en redes de ${num(r['Horas totales'])} h<small>semana del ${corta(r.Semana)}</small></li>`).join('')}</ul>` : ''}`)}`;
  },
  ajustes() {
    const app = location.origin + location.pathname;
    const base = S.cfg.url ? `${S.cfg.url}?token=${encodeURIComponent(S.cfg.token)}` : '';
    const atajos = base ? [
      ...S.cfg.apps.map(a => [`Al abrir ${a}`, `${base}&action=redes&app=${encodeURIComponent(a)}&limite=${num(S.cfg.limite) || 15}`]),
      ['Resumen de las 7:00 y al llegar a la U', `${base}&action=resumen`],
      ['"Oye Siri, estoy aburrido"', `${base}&action=mision`],
      ['"Oye Siri, nota BESTLX" (agrega el texto dictado al final)', `${base}&action=nota&texto=`],
      ['+1 vaso de agua (widget)', `${base}&action=agua`],
      ['Salud nocturna (agrega pasos y horas)', `${base}&action=salud&pasos=PASOS&sueno=HORAS`],
      ['Resumen del domingo', `${base}&action=semana`],
      ['Foco Estudio → abrir modo enfoque', `${app}?enfoque=1`],
      ['Llegar a casa → misión', `${app}?mision=1`]
    ] : [];
    return `${card('progreso', 'registro', 'Google Sheet', `<p class="muted">${S.cfg.url ? (ui.sync || (S.queue.length ? `${S.queue.length} registros esperando envío.` : 'Conectado. Todo está guardado en tu Sheet.')) : 'Sin Sheet conectado: por ahora los datos viven solo en este teléfono.'}</p>
        ${S.cfg.url ? `<p class="muted">Canvas: ${S.canvasOn ? (S.canvas.length ? `${S.canvas.length} entregas, actualizado ${actualizadoCanvas()}` : 'configurado, sin datos aún') : 'sin configurar en el script'}.</p>` : ''}
        <label for="c-u">URL de la app web de Apps Script</label><input id="c-u" type="url" inputmode="url" autocapitalize="off" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.cfg.url)}">
        <label for="c-k">Token (el mismo que pusiste en Code.gs)</label><input id="c-k" autocapitalize="off" autocomplete="off" value="${esc(S.cfg.token)}">
        <label for="c-m">Meta diaria de páginas</label><input id="c-m" type="number" inputmode="numeric" min="1" value="${num(S.cfg.meta) || 10}">
        <label for="c-l">Límite diario de aperturas de redes</label><input id="c-l" type="number" inputmode="numeric" min="1" value="${num(S.cfg.limite) || 15}">
        <label for="c-a">Redes que cuentas (separadas por coma)</label><input id="c-a" autocomplete="off" value="${esc(S.cfg.apps.join(', '))}">
        <div class="row" style="margin-top:12px"><button class="pri grow" data-a="cfg-guardar">Guardar ajustes</button>${S.cfg.url ? '<button data-a="sync">Sincronizar</button>' : ''}</div>`)}
      ${card('progreso', 'info', 'URLs para tus Atajos', atajos.length ? `<p class="muted small">Toca para copiar y pégalas en la acción "Obtener contenido de URL".</p><ul class="list">${atajos.map(([t, u]) => `<li><button class="link-row" data-a="copiar" data-v="${esc(u)}">${esc(t)}<small>${esc(u.replace(/token=[^&]+/, 'token=•••'))}</small></button></li>`).join('')}</ul>` : '<p class="muted">Conecta el Sheet para ver aquí las URLs listas para copiar.</p>')}
      <button class="ghost" style="width:100%" data-a="intro">Ver otra vez cómo está organizada la app</button>`;
  }
};

/* ---------- modo enfoque ---------- */
let tick = null;
const enfoqueRestante = () => S.timer ? Math.max(0, S.timer.start + S.timer.min * 6e4 - Date.now()) : 0;
const fmtMin = ms => `${pad(Math.floor(ms / 6e4))}:${pad(Math.floor(ms / 1000) % 60)}`;
function enfoqueCard() {
  if (S.timer) {
    const r = enfoqueRestante();
    if (r > 0) return card('mis', 'mision', 'Modo enfoque', `<div class="reloj" id="reloj">${fmtMin(r)}</div><p class="center muted">${esc(S.timer.tema)}</p><button class="ghost" style="width:100%" data-a="enf-cancelar">Cancelar bloque</button>`);
    return card('mis', 'mision', 'Bloque completado', `<p class="big">25 minutos en: ${esc(S.timer.tema)}</p><p class="muted">Descansa 5 minutos lejos de la pantalla.</p><button class="pri xl" data-a="enf-fin">Cobrar +10 XP</button>`);
  }
  const p = pendientes().filter(r => r.h > 0).slice(0, 5);
  return card('mis', 'registro', 'Modo enfoque', `<p class="muted">25 minutos en una sola cosa, con el celular boca abajo. Cada bloque da XP de Mente.</p>
    ${p.length ? `<div class="chips">${p.map(r => `<button data-a="enf-tema" data-v="${esc(r.Materia + ': ' + r['Título'])}" class="${ui.enfTema === r.Materia + ': ' + r['Título'] ? 'on' : ''}">${esc(r.Materia)} · ${esc(String(r['Título']).slice(0, 28))}</button>`).join('')}</div>` : ''}
    <input id="enf-t" data-draft="enf-t" placeholder="¿En qué vas a trabajar?" value="${esc(draft('enf-t', ui.enfTema || ''))}">
    <button class="pri xl" style="margin-top:12px" data-a="enf-start">Empezar 25 minutos</button>`);
}
function startTick() {
  clearInterval(tick);
  tick = setInterval(() => {
    if (!S.timer) return clearInterval(tick);
    const el = $('#reloj');
    if (enfoqueRestante() <= 0) { clearInterval(tick); if (navigator.vibrate) navigator.vibrate(300); render(); }
    else if (el) el.textContent = fmtMin(enfoqueRestante());
  }, 1000);
}

/* ---------- overlays ---------- */
function overlay() {
  const o = ui.overlay;
  if (!o) return '';
  if (o.tipo === 'rango') {
    const r = RANGOS[o.i];
    return `<div class="ov scarlet-ov" role="dialog" aria-modal="true" aria-label="Nuevo rango: ${r.n}"><div class="ov-in">
      <svg viewBox="0 0 120 140" class="ov-sil" aria-hidden="true"><path d="M60 8 18 24v34c0 32 18 56 42 70 24-14 42-38 42-70V24z" fill="#060504" stroke="#ff6b6b" stroke-width="1.5"/><path d="M38 100 60 38 82 100" fill="none" stroke="#c8102e" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/></svg>
      <p class="ov-k">Nuevo rango</p><h2 class="ov-t">${r.n}</h2><p class="ov-s">${xpTotal()} XP${r.n === 'GOD' ? ' · llegaste a la cima' : ''}</p>
      <button class="pri scarlet" data-a="ov-cerrar">Continuar</button></div></div>`;
  }
  if (o.tipo === 'intro') {
    const rows = [['hoy', 'Hoy', 'Lo pendiente del día y el botón Estoy aburrido.'], ['clases', 'Clases', 'Canvas, modo prueba y modo enfoque.'], ['mis', 'Misiones', 'Ventas, negocios, Cuarenta, Go y redes, inglés y repasos.'], ['lectura', 'Diario', 'Lectura, social, cuerpo y notas, cada uno con su color.'], ['progreso', 'Progreso', 'Tu rango, el jefe, la tienda, el tablero y los ajustes.']];
    return `<div class="ov" role="dialog" aria-modal="true" aria-label="Cómo está organizada BESTLX"><div class="ov-in left">
      <h2 class="ov-t sm">Así está organizada BESTLX</h2>
      <ul class="mapa">${rows.map(([z, t, d]) => `<li style="--acc:var(--c-${z})">${ico(z === 'lectura' ? 'diario' : z)}<div><b>${t}</b><span>${d}</span></div></li>`).join('')}</ul>
      <p class="muted small">Tarjeta con borde brillante = misión por hacer. Tarjeta simple = algo para anotar. Sin borde = información. Todo da XP a tus 5 atributos; al subir de rango la pantalla se tiñe de escarlata.</p>
      <button class="pri xl" data-a="ov-cerrar">Empezar</button></div></div>`;
  }
  return '';
}

/* ---------- render ---------- */
const ICON_TAB = { hoy: 'hoy', clases: 'clases', misiones: 'mis', diario: 'diario', progreso: 'progreso' };
const ZONA_TAB = { hoy: 'hoy', clases: 'clases', misiones: 'mis', diario: 'lectura', progreso: 'progreso' };
const NOMBRES = { hoy: 'Hoy', clases: 'Clases', misiones: 'Misiones', diario: 'Diario', progreso: 'Progreso' };
function render() {
  const zona = ui.tab === 'diario' ? ui.sub.diario : ZONA_TAB[ui.tab];
  document.body.style.setProperty('--acc', `var(--c-${zona})`);
  document.body.style.setProperty('--acc-hi', `var(--c-${zona}-hi)`);
  const act = document.activeElement, actId = act && act.dataset && act.dataset.live, pos = act && act.selectionStart;
  $('#view').innerHTML = V[ui.tab]();
  $('#tabs').innerHTML = Object.keys(V).map(k => `<button data-a="tab" data-v="${k}" class="${ui.tab === k ? 'on' : ''}" style="--acc:var(--c-${ZONA_TAB[k]})" ${ui.tab === k ? 'aria-current="page"' : ''}>${ico(ICON_TAB[k])}${NOMBRES[k]}${k === 'misiones' && repasosPend().length ? '<i class="dot"></i>' : ''}</button>`).join('');
  $('#ov').innerHTML = overlay();
  if (actId) { const el = document.querySelector(`[data-live="${actId}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* */ } } }
  if (S.timer && ui.tab === 'clases') startTick();
}

/* ---------- acciones ---------- */
const A = {
  tab(v) { ui.tab = v; ui.form = ''; window.scrollTo(0, 0); },
  sub(v) { const [t, s] = v.split(':'); ui.sub[t] = s; window.scrollTo(0, 0); },
  ir(v) { const [t, s] = v.split(':'); ui.tab = t; if (s) ui.sub[t] = s; ui.form = ''; window.scrollTo(0, 0); },
  cancelar() { ui.form = ''; },
  copiar(v) { copiar(v); },
  intro() { ui.overlay = { tipo: 'intro' }; },
  'ov-cerrar'() { if (ui.overlay && ui.overlay.tipo === 'intro') { S.intro = true; save(); } ui.overlay = null; },
  /* estoy aburrido */
  'ab-lug'(v) { S.ab.lug = v; save(); },
  'ab-min'(v) { S.ab.min = Number(v); save(); },
  'ab-dame'() { S.mision = generarMision(); save(); if (!S.mision) toast('No hay misiones para ese lugar y tiempo'); },
  'ab-otra'() { const m = S.mision, n = generarMision(m.id); if (n) { n.saltos = m.saltos + 1; n.ts = m.ts; S.mision = n; save(); } },
  'ab-cancelar'() { S.mision = null; save(); },
  concepto(v, el) {
    const it = itemPorId(v); if (!it) return;
    award('Mente', 6, 'concepto:' + v, it.t);
    addRepaso(v);
    if (el.dataset.c === 'mision') completarMision(it.t);
  },
  ingles(v, el) {
    const it = itemPorId(v); if (!it) return;
    award('Mente', 4, `ingles:${v}:${hoy()}`, it.en);
    addRepaso(v);
    if (el.dataset.c === 'mision') completarMision('Inglés');
  },
  'sim-ver'(v) { ui.sim = { id: v, rev: true, rate: 0 }; },
  'sim-rate'(v) { if (ui.sim) ui.sim.rate = Number(v); },
  'sim-fin'(v, el) {
    const r = ui.sim && ui.sim.rate || 3;
    award('Carisma', 6 + r, 'sim:' + Date.now(), `Simulador ${r}/5`);
    delete ui.draft['sim-' + v]; ui.sim = null;
    if (el.dataset.c === 'mision') completarMision('Simulador');
    else ui.simId = null;
  },
  'sim-nuevo'() { ui.simId = null; ui.sim = null; },
  'caso-ver'(v) { ui.caso = v; },
  'caso-fin'(v, el) {
    award('Mente', 12, 'caso:' + v, 'Caso de negocio');
    const t = (ui.draft['caso-' + v] || '').trim();
    if (t) append('notas', { 'Fecha y hora': ahora(), Tipo: 'rapida', Texto: 'Caso: ' + t, Etiqueta: 'negocio' });
    delete ui.draft['caso-' + v]; ui.caso = null;
    if (el.dataset.c === 'mision') completarMision('Caso');
  },
  tech(v, el) {
    const it = D.ap.tech.find(x => x.id === v); if (!it) return;
    award('Mente', 10 + 5 * it.n, 'tech:' + v, it.r);
    if (el.dataset.c === 'mision') completarMision(it.area);
  },
  'prueba-fin'(v, el) {
    award('Mente', 15, `prueba:${hoy()}:${v}`, 'Estudio para prueba');
    if (el.dataset.c === 'mision') completarMision('Modo prueba');
  },
  'texto-fin'(v) {
    const m = D.ap.misiones.find(x => x.id === v); if (!m) return;
    if (m.accion === 'enfoque') { completarMision(m.t); ui.tab = 'clases'; return; }
    if (m.accion === 'rutina') { completarMision(m.t); ui.tab = 'diario'; ui.sub.diario = 'cuerpo'; return; }
    if (m.accion === 'agua') append('agua', { 'Fecha y hora': ahora(), Vasos: 1 });
    if (m.xp) award(m.a, m.xp, 'mis:' + S.mision.ts, m.t);
    completarMision(m.t);
    evaluar();
  },
  /* cuarenta */
  'c40-ir'(v) { if (v === 'mision') { ui.tab = 'misiones'; ui.sub.misiones = 'cuarenta'; } c40Empezar(v === 'mision' || (S.mision && S.mision.tipo === 'cuarenta')); },
  'c40-r'(v) { c40Responder(v); },
  'c40-salir'() { ui.c40 = null; },
  /* repaso */
  'rep-ver'(v) { ui.rep[v] = true; },
  'rep-ok'(v) {
    const r = repasoDe(v), p = num(r.Paso) + 1;
    upsert('repaso', ['ID'], Object.assign({}, r, { Paso: p, Siguiente: addDays(hoy(), [1, 2, 4, 0][p] || 0) }));
    award('Mente', 3, `rep:${v}:${hoy()}`, 'Repaso');
    if (p >= 3) toast('Concepto dominado ★');
    delete ui.rep[v];
  },
  'rep-no'(v) {
    const r = repasoDe(v);
    upsert('repaso', ['ID'], Object.assign({}, r, { Paso: 0, Siguiente: addDays(hoy(), 1) }));
    award('Mente', 1, `rep:${v}:${hoy()}`, 'Repaso');
    delete ui.rep[v];
  },
  /* social y lectura */
  rate(v) { ui.rate = Number(v); },
  'reto-si'() { const r = retoHoy(); ui.form = 'reto'; ui.rate = r.reg ? num(r.reg['Cómo te fue']) : 0; },
  'reto-no'() { const r = retoHoy(); upsert('social', ['Fecha'], { Fecha: hoy(), Nivel: r.l, Reto: r.texto, Hecho: 'no', 'Cómo te fue': '', Nota: '' }); },
  'reto-otro'() { const f = hoy(); S.swap = { f, n: (S.swap.f === f ? S.swap.n : 0) + 1 }; save(); },
  'reto-guardar'() {
    const antes = nivel().l, r = retoHoy();
    upsert('social', ['Fecha'], { Fecha: hoy(), Nivel: r.l, Reto: r.texto, Hecho: 'sí', 'Cómo te fue': ui.rate || '', Nota: $('#nota').value.trim() });
    ui.form = '';
    if (nivel().l > antes) toast(`¡Subiste al nivel social ${nivel().l}!`, 'scarlet');
    award('Carisma', 15, 'reto:' + hoy(), r.texto);
  },
  'leer-guardar'() {
    const b = libroActual(), p = Math.max(0, Math.round(num($('#pags').value)));
    upsert('lectura', ['Fecha', 'Libro'], { Fecha: hoy(), Libro: b.Libro, 'Páginas': p, Minutos: '' });
    if (p > 0) award('Disciplina', 8, 'leer:' + hoy(), 'Lectura');
    if (paginasDia(hoy()) >= (num(S.cfg.meta) || 10)) award('Disciplina', 7, 'meta:' + hoy(), 'Meta de lectura');
    if (p > 0 && ui.minimoAbierto) ui.minimo.m1 = true;
  },
  'libro-cambiar'() { ui.form = 'libro'; },
  'libro-fin'() {
    const b = libroActual();
    if (!confirm(`¿Marcar "${b.Libro}" como terminado?`)) return;
    upsert('libros', ['Libro', 'Inicio'], Object.assign({}, b, { Fin: hoy() }));
    award('Disciplina', 40, `libro:${b.Libro}:${b.Inicio}`, b.Libro);
  },
  'libro-guardar'() {
    const t = $('#l-t').value.trim();
    if (!t) return toast('Escribe el título');
    const b = libroActual();
    if (b) upsert('libros', ['Libro', 'Inicio'], Object.assign({}, b, { Fin: hoy() }));
    upsert('libros', ['Libro', 'Inicio'], { Libro: t, Autor: $('#l-a').value.trim(), Inicio: hoy(), Fin: '', 'Páginas totales': Math.round(num($('#l-p').value)) || '' });
    ui.form = '';
  },
  sit(v) { ui.sit = v; ui.q = rnd(40); },
  otra() { ui.q++; },
  persona(v) {
    const p = S.personas.find(x => x.Nombre === v); if (!p) return;
    upsert('personas', ['Nombre'], Object.assign({}, p, { 'Último': hoy() }));
    award('Carisma', 8, `persona:${v}:${hoy()}`, 'Escribiste a ' + v);
  },
  'persona-add'() {
    const n = $('#p-n').value.trim(); if (!n) return toast('Escribe un nombre');
    upsert('personas', ['Nombre'], { Nombre: n, Cada: Math.max(1, Math.round(num($('#p-c').value)) || 14), 'Último': '' });
  },
  /* redes y agua */
  abrir(v) { append('redes', { 'Fecha y hora': ahora(), App: v }); },
  agua() {
    append('agua', { 'Fecha y hora': ahora(), Vasos: 1 });
    if (ui.minimoAbierto) ui.minimo.m2 = true;
    evaluar();
    toast(vasos(hoy()) >= 8 ? 'Meta de agua cumplida' : `Vaso ${vasos(hoy())} de 8`);
  },
  salud() {
    const p = Math.round(num($('#s-p').value)), s = Math.round(num($('#s-s').value) * 10) / 10;
    upsert('salud', ['Fecha'], { Fecha: hoy(), Pasos: p || '', 'Sueño': s || '' });
    evaluar(); toast('Guardado');
  },
  rutina(v) {
    const r = D.ap.rutinas.find(x => x.id === v); if (!r) return;
    award('Fuerza', r.min >= 20 ? 25 : 15, `rutina:${v}:${hoy()}`, r.nombre);
  },
  /* notas */
  energia(v) { ui.energia = Number(v); const dn = notaDe(hoy(), 'dia'); if (dn) upsert('notas', ['Fecha y hora', 'Tipo'], Object.assign({}, dn, { 'Energía': Number(v) })); },
  'nota-dia'() {
    const t = ($('#nd').value || '').trim(), dn = notaDe(hoy(), 'dia');
    if (!t && !ui.energia && !dn) return toast('Escribe algo o elige tu energía');
    upsert('notas', ['Fecha y hora', 'Tipo'], { 'Fecha y hora': hoy(), Tipo: 'dia', Texto: t, 'Energía': ui.energia || (dn ? num(dn['Energía']) : ''), Etiqueta: '', Abre: '' });
    delete ui.draft.nd;
    award('Disciplina', 5, 'nota:' + hoy(), 'Nota del día');
  },
  ritual() {
    const a = ($('#rt1').value || '').trim(), b = ($('#rt2').value || '').trim(), c = ($('#rt3').value || '').trim();
    if (!a && !b && !c) return toast('Responde al menos una');
    upsert('notas', ['Fecha y hora', 'Tipo'], { 'Fecha y hora': hoy(), Tipo: 'ritual', Texto: `Bien: ${a}\nMejoro: ${b}\nAgradezco: ${c}`, 'Energía': '', Etiqueta: '', Abre: '' });
    ['rt1', 'rt2', 'rt3'].forEach(k => delete ui.draft[k]);
    award('Disciplina', 10, 'ritual:' + hoy(), 'Ritual nocturno');
  },
  etiqueta(v) { ui.etiqueta = v; },
  'nota-rapida'() {
    const t = ($('#nr').value || '').trim(); if (!t) return toast('Escribe la nota');
    append('notas', { 'Fecha y hora': ahora(), Tipo: 'rapida', Texto: t, 'Energía': '', Etiqueta: ui.etiqueta, Abre: '' });
    delete ui.draft.nr; toast('Nota guardada');
  },
  victoria() {
    const t = ($('#vc').value || '').trim(); if (!t) return toast('Escribe tu victoria');
    append('notas', { 'Fecha y hora': ahora(), Tipo: 'victoria', Texto: t, 'Energía': '', Etiqueta: '', Abre: '' });
    delete ui.draft.vc;
    award('Disciplina', 3, 'victoria:' + Date.now(), 'Victoria');
  },
  'carta-m'(v) { ui.carta = Number(v); },
  carta() {
    const t = ($('#ct').value || '').trim(); if (!t) return toast('Escribe la carta');
    const d = new Date(); d.setMonth(d.getMonth() + ui.carta);
    append('notas', { 'Fecha y hora': ahora(), Tipo: 'carta', Texto: t, 'Energía': '', Etiqueta: '', Abre: iso(d) });
    delete ui.draft.ct; toast(`Carta sellada hasta el ${corta(iso(d))}`);
  },
  'nota-filtro'(v) { ui.notaFiltro = v; },
  'guion-tipo'(v) { ui.guionTipo = v; },
  'guion-add'() {
    const t = ($('#g-t').value || '').trim(); if (!t) return toast('Escribe el guion');
    append('notas', { 'Fecha y hora': ahora(), Tipo: 'guion', Texto: t, 'Energía': '', Etiqueta: ui.guionTipo, Abre: '' });
    delete ui.draft['g-t']; toast('Guion guardado');
  },
  /* escudo, día mínimo, jefe, tienda */
  escudo() { const ayer = addDays(hoy(), -1); award('Disciplina', 0, 'escudo:' + ayer, 'Escudo de racha', { mult: false, silent: true }); toast('Racha salvada'); },
  'minimo-abrir'() { ui.minimoAbierto = true; },
  minimo(v) {
    ui.minimo[v] = !ui.minimo[v];
    if (ui.minimo.m1 && ui.minimo.m2 && ui.minimo.m3) { award('Disciplina', 5, 'minimo:' + hoy(), 'Día mínimo', { mult: false }); ui.minimoAbierto = false; toast('Rachas a salvo por hoy'); }
  },
  jefe() {
    const j = jefe(); if (!j.listo || j.derrotado) return;
    ATTR.forEach(a => award(a, 30, `jefe:${j.lun}:${a}`, 'Jefe: ' + j.nombre, { mult: false, silent: true }));
    toast(`¡Derrotaste a ${j.nombre}!`, 'scarlet');
  },
  canje(v) {
    const [p, c] = v.split('|'), costo = num(c);
    if (saldo() < costo) return toast(`Te faltan ${costo - saldo()} XP`);
    if (!confirm(`¿Canjear "${p}" por ${costo} XP?`)) return;
    append('canjes', { 'Fecha y hora': ahora(), Premio: p, Costo: costo });
    toast(p === 'Escudo de racha' ? 'Escudo comprado' : 'Disfrútalo: te lo ganaste');
  },
  'premio-add'() {
    const p = $('#t-p').value.trim(), c = Math.round(num($('#t-c').value));
    if (!p || !c) return toast('Escribe premio y costo');
    upsert('tienda', ['Premio'], { Premio: p, Costo: c });
  },
  /* enfoque */
  'enf-tema'(v) { ui.enfTema = v; ui.draft['enf-t'] = v; },
  'enf-start'() {
    const t = ($('#enf-t').value || '').trim() || 'Enfoque';
    S.timer = { start: Date.now(), min: 25, tema: t }; save(); startTick();
  },
  'enf-cancelar'() { if (confirm('¿Cancelar el bloque?')) { S.timer = null; save(); } },
  'enf-fin'() {
    const t = S.timer; if (!t) return;
    const previo = S.enfoque.filter(r => dia(r) === hoy()).pop();
    append('enfoque', { 'Fecha y hora': ahora(), Tema: t.tema, Minutos: t.min });
    award('Mente', 10, 'enf:' + t.start, t.tema);
    S.timer = null; save();
    if (previo && (Date.now() - new Date(String(previo['Fecha y hora']).replace(' ', 'T'))) < 45 * 6e4) toast('50 minutos de enfoque: estira 2 minutos', 'scarlet');
  },
  /* clases */
  'ver-hechas'() { ui.verHechas = !ui.verHechas; },
  'canvas-sync'() { syncCanvas(); },
  /* progreso */
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
    S.cfg.limite = Math.max(1, Math.round(num($('#c-l').value)) || 15);
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
  A[b.dataset.a](b.dataset.v, b);
  render();
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.draft) ui.draft[el.dataset.draft] = el.value;
  if (el.dataset && el.dataset.live) { ui[el.dataset.live] = el.value; render(); }
});

/* ---------- arranque ---------- */
async function cargar() {
  try {
    const [f, r, p, a] = await Promise.all(['frases', 'retos', 'preguntas', 'aprender'].map(n => fetch(`./data/${n}.json`).then(x => x.json())));
    const temas = Object.keys(f), largo = Math.max(...temas.map(t => f[t].es.length));
    for (let i = 0; i < largo; i++) for (let pasada = 0; pasada < 2; pasada++) temas.forEach((t, ti) => {
      const l = (ti + pasada) % 2 === 0 ? 'es' : 'en';
      if (f[t][l][i]) D.frases.push({ t: f[t][l][i], tema: t, l });
    });
    D.retos = r; D.preguntas = p; D.ap = Object.assign(D.ap, a);
  } catch (e) { toast('No se pudo cargar el contenido'); }
  ui.q = rnd(40);
  const qs = new URLSearchParams(location.search);
  if (qs.has('enfoque')) ui.tab = 'clases';
  if (qs.has('mision')) { ui.tab = 'hoy'; if (!S.mision) S.mision = generarMision(); }
  if (qs.has('tab') && V[qs.get('tab')]) ui.tab = qs.get('tab');
  if (!S.intro) ui.overlay = { tipo: 'intro' };
  if (!S.cfg.url) ui.pulled = true;
  evaluar();
  render();
}
render();
cargar();
pull();
/* el día mínimo marca solo la tercera casilla al repasar o aprender */
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && ui.minimoAbierto && /^(concepto|ingles|rep-ok|rep-no)$/.test(b.dataset.a)) { ui.minimo.m3 = true; render(); } }, true);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { evaluar(); render(); pull(); } });
window.addEventListener('online', flush);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
