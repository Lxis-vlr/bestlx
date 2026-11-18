/**
 * BESTLX — puente entre la app, tu Google Sheet y Canvas.
 *
 * 1) Cambia TOKEN por una clave tuya (cualquier texto largo, sin espacios).
 * 2) Ejecuta una vez setup() para crear las pestañas.
 * 3) Para Canvas: en Configuración del proyecto > Propiedades del script agrega
 *      CANVAS_URL   = https://tu-canvas.instructure.com   (sin /api/v1)
 *      CANVAS_TOKEN = el token que generaste en Canvas
 *      EMAIL        = (opcional) correo para las alertas; si falta usa el tuyo
 *    y ejecuta una vez instalarActivadores() para que se sincronice cada hora.
 * 4) Implementar > Nueva implementación > App web (Ejecutar como: yo; Acceso: cualquier persona).
 */
const TOKEN = 'CAMBIA-ESTE-TOKEN';
const TZ = 'America/Guayaquil';

const TABS = {
  'Lectura': ['Fecha', 'Libro', 'Páginas', 'Minutos'],
  'Libros': ['Libro', 'Autor', 'Inicio', 'Fin', 'Páginas totales'],
  'Social': ['Fecha', 'Nivel', 'Reto', 'Hecho', 'Cómo te fue', 'Nota'],
  'Redes': ['Fecha y hora', 'App'],
  'Tiempo en pantalla': ['Semana', 'Horas totales', 'Horas en redes'],
  'Canvas': ['ID', 'Materia', 'Tipo', 'Título', 'Vence', 'Puntos', 'Peso', 'Prioridad', 'Entregado', 'Nota', 'Link', 'Actualizado'],
  'XP': ['Fecha y hora', 'Atributo', 'Puntos', 'Motivo', 'Detalle'],
  'Notas': ['Fecha y hora', 'Tipo', 'Texto', 'Energía', 'Etiqueta', 'Abre'],
  'Agua': ['Fecha y hora', 'Vasos'],
  'Salud': ['Fecha', 'Pasos', 'Sueño'],
  'Enfoque': ['Fecha y hora', 'Tema', 'Minutos'],
  'Repaso': ['ID', 'Paso', 'Siguiente', 'Visto'],
  'Personas': ['Nombre', 'Cada', 'Último'],
  'Tienda': ['Premio', 'Costo'],
  'Canjes': ['Fecha y hora', 'Premio', 'Costo']
};
// La app solo escribe en estas; Canvas la llena el script
const ESCRIBIBLES = ['Lectura', 'Libros', 'Social', 'Redes', 'Tiempo en pantalla', 'XP', 'Notas', 'Agua', 'Salud', 'Enfoque', 'Repaso', 'Personas', 'Tienda', 'Canjes'];
// Columnas que se guardan como texto para que Sheets no cambie el formato de las fechas
const TEXTO = ['Fecha', 'Inicio', 'Fin', 'Fecha y hora', 'Semana', 'Libro', 'Reto', 'Nota', 'Autor', 'App', 'Hecho',
  'ID', 'Materia', 'Tipo', 'Título', 'Vence', 'Prioridad', 'Entregado', 'Link', 'Actualizado',
  'Atributo', 'Motivo', 'Detalle', 'Texto', 'Etiqueta', 'Abre', 'Tema', 'Siguiente', 'Visto', 'Nombre', 'Último', 'Premio'];
const NUMEROS = ['Páginas', 'Minutos', 'Páginas totales', 'Nivel', 'Cómo te fue', 'Horas totales', 'Horas en redes', 'Puntos', 'Peso',
  'Energía', 'Vasos', 'Pasos', 'Sueño', 'Paso', 'Cada', 'Costo'];

/* ======================= Sheet ======================= */

/** Crea las pestañas con sus encabezados. Se puede ejecutar varias veces sin borrar datos. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach(function (nombre) {
    const cols = TABS[nombre];
    const sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    cols.forEach(function (c, i) {
      if (TEXTO.indexOf(c) >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
}

function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function salidaTexto(t) {
  return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT);
}

/** Convierte una celda a texto; si Sheets la volvió fecha, la regresa a AAAA-MM-DD. */
function texto(v, conHora) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, conHora ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
  return String(v);
}

function leer(nombre) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!sh || sh.getLastRow() < 2) return [];
  const cols = TABS[nombre];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues()
    .filter(function (f) { return f.join('') !== ''; })
    .map(function (f) {
      const o = {};
      cols.forEach(function (c, i) { o[c] = texto(f[i], c === 'Fecha y hora' || c === 'Vence' || c === 'Actualizado'); });
      return o;
    });
}

function fila(nombre, row) {
  return TABS[nombre].map(function (c) {
    const v = row[c];
    if (v === undefined || v === null || v === '') return '';
    return NUMEROS.indexOf(c) >= 0 && !isNaN(Number(v)) ? Number(v) : String(v).slice(0, 500);
  });
}

function agregar(nombre, row) {
  SpreadsheetApp.getActive().getSheetByName(nombre).appendRow(fila(nombre, row));
}

/** Actualiza la fila cuyas columnas "keys" coinciden; si no existe, la agrega. */
function actualizar(nombre, keys, row) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nombre);
  const cols = TABS[nombre];
  const n = sh.getLastRow() - 1;
  if (n > 0) {
    const datos = sh.getRange(2, 1, n, cols.length).getValues();
    for (let i = 0; i < datos.length; i++) {
      const igual = keys.every(function (k) {
        const c = cols.indexOf(k);
        return c >= 0 && texto(datos[i][c], k === 'Fecha y hora') === String(row[k]);
      });
      if (igual) { sh.getRange(i + 2, 1, 1, cols.length).setValues([fila(nombre, row)]); return; }
    }
  }
  agregar(nombre, row);
}

const ahoraTxt = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
const hoyTxt = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

function registrarApertura(app) {
  const nombre = String(app || 'Otra').trim().slice(0, 30);
  agregar('Redes', { 'Fecha y hora': ahoraTxt(), 'App': nombre });
  return leer('Redes').filter(function (r) { return String(r['Fecha y hora']).slice(0, 10) === hoyTxt(); }).length;
}

/* Misiones cortas para Siri y para el aviso al abrir redes */
const ALTERNATIVAS = [
  '15 sentadillas ahora mismo.', 'Toma un vaso de agua completo.', 'Lee 5 páginas de tu libro.',
  'Escríbele a alguien de tu lista de personas.', 'Haz 3 repasos en BESTLX.', 'Estira la espalda 2 minutos.',
  'Escribe una idea de negocio en tus notas.', 'Lee el concepto de ventas del día.', 'Practica una frase en inglés en voz alta.',
  'Respira lento 1 minuto: 4 segundos dentro, 6 fuera.', 'Planea las 3 tareas más importantes de mañana.',
  'Haz una ronda del entrenador de Cuarenta.', 'Ordena tu escritorio 5 minutos.', 'Abre BESTLX y toca Estoy aburrido.',
  'Resuelve un micro-reto de Go o de redes.', 'Escribe una victoria de hoy.', '10 flexiones, aunque sean de rodillas.',
  'Mira por la ventana 1 minuto sin pantalla.', 'Explica en voz baja el tema de tu última clase.', 'Practica tu pitch de 30 segundos.'
];
function alternativa() { return ALTERNATIVAS[Math.floor(Math.random() * ALTERNATIVAS.length)]; }

function textoRedes(app, n, limite) {
  const lim = Number(limite) || 15;
  const h = Number(Utilities.formatDate(new Date(), TZ, 'H'));
  let t = app + ' · apertura ' + n + ' de ' + lim + ' hoy.';
  if (n > lim) t += ' Ya pasaste tu límite: esto resta XP de Enfoque.';
  if (h >= 23 || h < 5) t += ' Ya es tarde: ciérrala y duerme, mañana te lo agradeces.';
  return t + '\nEn vez de eso: ' + alternativa();
}

/** Resumen de los últimos 7 días para la notificación del domingo. */
function resumenSemana() {
  const desde = Utilities.formatDate(new Date(Date.now() - 6 * 864e5), TZ, 'yyyy-MM-dd');
  const enSemana = function (r, col) { return String(r[col]).slice(0, 10) >= desde; };
  const xp = leer('XP').filter(function (r) { return enSemana(r, 'Fecha y hora'); });
  const por = {};
  xp.forEach(function (r) { por[r.Atributo] = (por[r.Atributo] || 0) + (Number(r.Puntos) || 0); });
  const total = Object.keys(por).reduce(function (t, k) { return t + por[k]; }, 0);
  const jefe = xp.some(function (r) { return String(r.Motivo).indexOf('jefe:') === 0; });
  const pags = leer('Lectura').filter(function (r) { return enSemana(r, 'Fecha'); }).reduce(function (t, r) { return t + (Number(r['Páginas']) || 0); }, 0);
  const redes = leer('Redes').filter(function (r) { return enSemana(r, 'Fecha y hora'); }).length;
  const enfoque = leer('Enfoque').filter(function (r) { return enSemana(r, 'Fecha y hora'); }).reduce(function (t, r) { return t + (Number(r.Minutos) || 0); }, 0);
  const attrs = Object.keys(por).filter(function (k) { return por[k]; }).sort(function (a, b) { return por[b] - por[a]; })
    .map(function (k) { return k + ' +' + por[k]; }).join(' · ');
  return 'BESTLX · tu semana: +' + total + ' XP' + (attrs ? '\n' + attrs : '') +
    '\n' + pags + ' páginas · ' + Math.round(enfoque / 6) / 10 + ' h de enfoque · ' + redes + ' aperturas de redes' +
    '\nJefe semanal: ' + (jefe ? 'derrotado' : 'sigue en pie');
}

/* ======================= Canvas ======================= */

function cfgCanvas() {
  const p = PropertiesService.getScriptProperties();
  return {
    url: (p.getProperty('CANVAS_URL') || '').trim().replace(/\/+$/, ''),
    token: (p.getProperty('CANVAS_TOKEN') || '').trim(),
    email: (p.getProperty('EMAIL') || '').trim() || Session.getEffectiveUser().getEmail()
  };
}

/** GET a la API de Canvas siguiendo la paginación (encabezado Link). */
function canvasGet(path) {
  const c = cfgCanvas();
  if (!c.url || !c.token) throw new Error('Faltan CANVAS_URL o CANVAS_TOKEN en las Propiedades del script');
  let url = c.url + '/api/v1' + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'per_page=100';
  let out = [];
  for (let i = 0; i < 10 && url; i++) {
    const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + c.token }, muteHttpExceptions: true });
    if (r.getResponseCode() >= 300) throw new Error('Canvas respondió ' + r.getResponseCode() + ' en ' + path);
    out = out.concat(JSON.parse(r.getContentText()));
    const h = r.getAllHeaders();
    const link = String(h['Link'] || h['link'] || '');
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : null;
  }
  return out;
}

function prioridad(peso, horas, tipo) {
  if (tipo === 'prueba' && horas <= 72) return 'Alta';
  if (peso >= 5 || horas <= 48) return 'Alta';
  if (peso >= 2) return 'Media';
  return 'Baja';
}

/**
 * Lee Canvas, calcula peso y prioridad, reescribe la pestaña Canvas y manda alertas.
 * Se ejecuta cada hora con el activador; también desde la app (Sincronizar).
 */
function syncCanvas() {
  const ahora = new Date();
  const cursos = canvasGet('/courses?enrollment_state=active&include[]=total_scores')
    .filter(function (c) { return c && c.name && !c.access_restricted_by_date; });
  const filas = [];

  cursos.forEach(function (curso) {
    let grupos, tareas;
    try {
      grupos = canvasGet('/courses/' + curso.id + '/assignment_groups');
      tareas = canvasGet('/courses/' + curso.id + '/assignments?include[]=submission&order_by=due_at');
    } catch (e) { return; } // un curso sin acceso no debe tumbar el resto

    const pesoGrupo = {}, totalGrupo = {};
    grupos.forEach(function (g) { pesoGrupo[g.id] = Number(g.group_weight) || 0; totalGrupo[g.id] = 0; });
    let totalCurso = 0;
    tareas.forEach(function (t) {
      if (t.published === false) return;
      const p = Number(t.points_possible) || 0;
      totalCurso += p;
      totalGrupo[t.assignment_group_id] = (totalGrupo[t.assignment_group_id] || 0) + p;
    });
    const ponderado = !!curso.apply_assignment_group_weights;

    tareas.forEach(function (t) {
      if (t.published === false || !t.due_at) return;
      const vence = new Date(t.due_at);
      const horas = (vence - ahora) / 36e5;
      if (horas < -24 * 7 || horas > 24 * 60) return; // vencidas hace más de 7 días o a más de 60 días
      const pts = Number(t.points_possible) || 0;
      let peso = 0;
      if (ponderado && totalGrupo[t.assignment_group_id]) peso = pts / totalGrupo[t.assignment_group_id] * pesoGrupo[t.assignment_group_id];
      else if (totalCurso) peso = pts / totalCurso * 100;
      const tipos = t.submission_types || [];
      const tipo = (t.is_quiz_assignment || tipos.indexOf('online_quiz') >= 0) ? 'prueba' : 'tarea';
      const s = t.submission || {};
      const entregado = s.workflow_state && s.workflow_state !== 'unsubmitted';
      filas.push({
        'ID': String(t.id),
        'Materia': (curso.course_code || curso.name).slice(0, 40),
        'Tipo': tipo,
        'Título': t.name,
        'Vence': Utilities.formatDate(vence, TZ, 'yyyy-MM-dd HH:mm'),
        'Puntos': pts,
        'Peso': Math.round(peso * 10) / 10,
        'Prioridad': prioridad(peso, horas, tipo),
        'Entregado': entregado ? 'sí' : 'no',
        'Nota': s.score != null ? s.score : '',
        'Link': t.html_url,
        'Actualizado': Utilities.formatDate(ahora, TZ, 'yyyy-MM-dd HH:mm'),
        _horas: horas
      });
    });
  });

  filas.sort(function (a, b) { return a.Vence < b.Vence ? -1 : 1; });

  // Reescribe la pestaña completa
  const sh = SpreadsheetApp.getActive().getSheetByName('Canvas') || SpreadsheetApp.getActive().insertSheet('Canvas');
  const cols = TABS.Canvas;
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).clearContent();
  sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  if (filas.length) sh.getRange(2, 1, filas.length, cols.length).setValues(filas.map(function (f) { return fila('Canvas', f); }));

  alertasCorreo(filas);
  return filas.length;
}

/** Correo a 48 h y 24 h de una tarea, y a 72 h de una prueba. No repite el mismo aviso. */
function alertasCorreo(filas) {
  const props = PropertiesService.getScriptProperties();
  let enviados = {};
  try { enviados = JSON.parse(props.getProperty('AVISOS') || '{}'); } catch (e) { enviados = {}; }
  const nuevos = [], hoy = Date.now();

  filas.forEach(function (f) {
    if (f.Entregado === 'sí' || f._horas <= 0) return;
    const umbrales = f.Tipo === 'prueba' ? [72, 24] : [48, 24];
    umbrales.forEach(function (u) {
      const k = f.ID + ':' + u;
      if (f._horas <= u && !enviados[k]) { enviados[k] = hoy; nuevos.push({ f: f, u: u }); }
    });
  });
  // Olvida avisos de hace más de 30 días para que la propiedad no crezca sin fin
  Object.keys(enviados).forEach(function (k) { if (hoy - enviados[k] > 30 * 864e5) delete enviados[k]; });
  props.setProperty('AVISOS', JSON.stringify(enviados));

  if (!nuevos.length) return;
  const lineas = nuevos.map(function (n) {
    return '• ' + n.f.Materia + ' — ' + n.f.Título + '\n   ' + (n.f.Tipo === 'prueba' ? 'Prueba' : 'Tarea') +
      ' · vence ' + n.f.Vence + ' · pesa ' + n.f.Peso + '% · prioridad ' + n.f.Prioridad + '\n   ' + n.f.Link;
  });
  const asunto = 'BESTLX: ' + (nuevos.length === 1 ? 'vence pronto ' + nuevos[0].f.Título : nuevos.length + ' entregas vencen pronto');
  MailApp.sendEmail(cfgCanvas().email, asunto, lineas.join('\n\n'));
}

/** Texto corto para la notificación del Atajo de las 7:00. */
function resumenTexto() {
  try { syncCanvas(); } catch (e) { /* si Canvas falla, se usa lo último guardado */ }
  const ahora = new Date();
  const items = leer('Canvas').filter(function (f) { return f.Entregado !== 'sí'; })
    .map(function (f) { f.h = (new Date(f.Vence.replace(' ', 'T')) - ahora) / 36e5; return f; })
    .filter(function (f) { return f.h > -24 && f.h <= 24 * 7; })
    .sort(function (a, b) { return a.h - b.h; });
  if (!items.length) return 'BESTLX · Sin entregas en los próximos 7 días. Buen día para leer.';
  const dia = function (f) {
    if (f.h <= 0) return 'VENCIDA';
    if (f.h <= 24) return 'HOY ' + f.Vence.slice(11);
    if (f.h <= 48) return 'MAÑANA ' + f.Vence.slice(11);
    return Utilities.formatDate(new Date(f.Vence.replace(' ', 'T')), TZ, 'EEE d').toUpperCase();
  };
  const lineas = items.slice(0, 6).map(function (f) {
    return dia(f) + ' · ' + f.Materia + ': ' + f.Título + (f.Prioridad === 'Alta' ? ' ⚠' : '');
  });
  const alta = items.filter(function (f) { return f.Prioridad === 'Alta'; }).length;
  return 'BESTLX · ' + items.length + ' pendientes, ' + alta + ' de prioridad alta\n' + lineas.join('\n') + (items.length > 6 ? '\n…y ' + (items.length - 6) + ' más en la app' : '');
}

/** Ejecútala una vez a mano: deja syncCanvas corriendo cada hora. */
function instalarActivadores() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncCanvas') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncCanvas').timeBased().everyHours(1).create();
  return 'Listo: Canvas se sincroniza cada hora.';
}

/** Prueba rápida desde el editor: muestra tus materias activas en el registro. */
function probarCanvas() {
  const cursos = canvasGet('/courses?enrollment_state=active');
  Logger.log(cursos.map(function (c) { return c.id + ' · ' + c.name; }).join('\n'));
  return cursos.length;
}

/* ======================= Entradas HTTP ======================= */

/** Lectura de datos (la app), aperturas de redes (Atajo) y resumen (Atajo de las 7:00). */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.token !== TOKEN) return salida({ ok: false, error: 'token' });
  if (p.action === 'redes') { const n = registrarApertura(p.app); return salidaTexto(textoRedes(p.app || 'Red', n, p.limite)); }
  if (p.action === 'mision') return salidaTexto('Misión: ' + alternativa());
  if (p.action === 'nota') {
    const t = String(p.texto || '').trim().slice(0, 1000);
    if (!t) return salidaTexto('No escuché la nota.');
    agregar('Notas', { 'Fecha y hora': ahoraTxt(), 'Tipo': 'rapida', 'Texto': t, 'Etiqueta': 'siri' });
    return salidaTexto('Nota guardada en BESTLX.');
  }
  if (p.action === 'agua') {
    agregar('Agua', { 'Fecha y hora': ahoraTxt(), 'Vasos': 1 });
    const n = leer('Agua').filter(function (r) { return String(r['Fecha y hora']).slice(0, 10) === hoyTxt(); }).length;
    return salidaTexto('Vaso ' + n + ' de 8 hoy.' + (n >= 8 ? ' Meta cumplida.' : ''));
  }
  if (p.action === 'salud') {
    const pasos = Math.round(Number(String(p.pasos || '').replace(',', '.')) || 0);
    const sueno = Math.round((Number(String(p.sueno || '').replace(',', '.')) || 0) * 10) / 10;
    actualizar('Salud', ['Fecha'], { 'Fecha': p.fecha || hoyTxt(), 'Pasos': pasos || '', 'Sueño': sueno || '' });
    return salidaTexto('Salud guardada: ' + pasos + ' pasos' + (sueno ? ', ' + sueno + ' h de sueño' : '') + '.');
  }
  if (p.action === 'semana') return salidaTexto(resumenSemana());
  if (p.action === 'resumen') return salidaTexto(resumenTexto());
  if (p.action === 'canvas_sync') {
    try { return salida({ ok: true, n: syncCanvas() }); }
    catch (err) { return salida({ ok: false, error: 'canvas', detalle: String(err.message || err) }); }
  }
  if (p.action === 'all') {
    const data = {};
    Object.keys(TABS).forEach(function (n) { data[n] = leer(n); });
    data._canvas = !!(cfgCanvas().url && cfgCanvas().token);
    return salida({ ok: true, data: data });
  }
  return salida({ ok: true, app: 'BESTLX' });
}

/** Escritura desde la app: { token, action: 'append' | 'upsert', tab, keys, row } */
function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return salida({ ok: false, error: 'json' }); }
  if (b.token !== TOKEN) return salida({ ok: false, error: 'token' });
  if (ESCRIBIBLES.indexOf(b.tab) < 0 || typeof b.row !== 'object') return salida({ ok: false, error: 'tab' });
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (b.action === 'upsert' && Array.isArray(b.keys)) actualizar(b.tab, b.keys, b.row);
    else agregar(b.tab, b.row);
  } finally { lock.releaseLock(); }
  return salida({ ok: true });
}
