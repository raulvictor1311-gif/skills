/* Funções comuns da fábrica de reels. Node puro, sem dependência. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** A skill `reel` fica ao lado desta (mesma pasta de skills). */
export const SKILL_REEL = path.resolve(SKILL, '..', 'reel');
export const ESTUDIO = path.resolve(process.env.REELS_ESTUDIO || path.join(os.homedir(), 'reels-estudio'));
export const REDES = ['instagram', 'youtube'];

export const lerArgs = (argv = process.argv.slice(2)) => {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) {
      const nome = x.slice(2);
      const prox = argv[i + 1];
      if (prox !== undefined && !prox.startsWith('--')) { a[nome] = prox; i++; } else a[nome] = true;
    } else a._.push(x);
  }
  return a;
};

export const falhar = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

/** --lote aceita "semana-48", "lotes/semana-48" ou um caminho absoluto. */
export const pastaLote = (args, obrigatorio = true) => {
  if (typeof args.lote !== 'string') {
    if (obrigatorio) falhar('Falta --lote <nome>. Ex.: --lote semana-48');
    return null;
  }
  const v = args.lote;
  if (path.isAbsolute(v)) return v;
  if (v.includes('/')) return path.resolve(ESTUDIO, v);
  return path.join(ESTUDIO, 'lotes', v);
};

export const todosLotes = () => {
  const base = path.join(ESTUDIO, 'lotes');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).map((n) => path.join(base, n)).filter((p) => fs.existsSync(path.join(p, 'fila.json')));
};

export const lerFila = (lote) => {
  const arq = path.join(lote, 'fila.json');
  if (!fs.existsSync(arq)) falhar(`Não achei ${arq}. Crie o lote com: node fila.mjs novo --lote <nome>`);
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch (e) { falhar(`fila.json inválido: ${e.message}`); }
};

export const salvarFila = (lote, fila) => {
  const arq = path.join(lote, 'fila.json');
  const tmp = arq + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(fila, null, 2) + '\n');
  fs.renameSync(tmp, arq);
};

export const pastaReel = (slug) => path.join(ESTUDIO, 'reels', slug);
export const arquivoMp4 = (slug) => path.join(ESTUDIO, 'out', `${slug}.mp4`);

export const slugificar = (t, max = 40) => String(t)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, max).replace(/-+$/g, '') || 'reel';

/** Etapa de produção, lida dos arquivos (não depende de alguém marcar à mão). */
export const etapaProducao = (item) => {
  const pasta = pastaReel(item.slug);
  const temCenas = fs.existsSync(path.join(pasta, 'cenas.json'));
  const temPost = fs.existsSync(path.join(pasta, 'post.json'));
  const temMp4 = fs.existsSync(arquivoMp4(item.slug));
  if (temMp4 && temPost) return 'pronto';
  if (temMp4) return 'sem-legenda';
  if (temCenas && temPost) return 'roteirizado';
  if (temCenas) return 'sem-legenda';
  return 'pauta';
};

export const lerPost = (slug) => {
  const arq = path.join(pastaReel(slug), 'post.json');
  if (!fs.existsSync(arq)) return null;
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; }
};

/* ---------- datas e fuso ---------- */

const partes = (t, fuso) => {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  }).formatToParts(new Date(t));
  const g = (k) => p.find((x) => x.type === k).value;
  return { ano: +g('year'), mes: +g('month'), dia: +g('day'), hora: +g('hour'), min: +g('minute'), seg: +g('second'), semana: g('weekday') };
};

export const validarFuso = (fuso) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: fuso }); return true; } catch { return false; }
};

/** "2026-11-24" + "09:00" no fuso → Date (UTC). */
export const paraUTC = (data, hora, fuso) => {
  const [a, m, d] = data.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const alvo = Date.UTC(a, m - 1, d, hh, mm);
  const desloc = (t) => { const p = partes(t, fuso); return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.min, p.seg) - t; };
  let t = alvo - desloc(alvo);
  t = alvo - desloc(t);
  return new Date(t);
};

const DIAS = { Sun: 'dom', Mon: 'seg', Tue: 'ter', Wed: 'qua', Thu: 'qui', Fri: 'sex', Sat: 'sáb' };
const dois = (n) => String(n).padStart(2, '0');

export const local = (iso, fuso) => {
  const p = partes(new Date(iso).getTime(), fuso);
  return {
    data: `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`,
    hora: `${dois(p.hora)}:${dois(p.min)}`,
    semana: DIAS[p.semana],
    curta: `${DIAS[p.semana]} ${dois(p.dia)}/${dois(p.mes)} ${dois(p.hora)}:${dois(p.min)}`,
  };
};

export const somarDias = (data, n) => {
  const [a, m, d] = data.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return `${t.getUTCFullYear()}-${dois(t.getUTCMonth() + 1)}-${dois(t.getUTCDate())}`;
};

export const hojeNoFuso = (fuso) => local(new Date().toISOString(), fuso).data;

/* ---------- tabela simples no terminal ---------- */
export const tabela = (linhas, colunas) => {
  const larg = colunas.map((c) => Math.max(c.length, ...linhas.map((l) => String(l[c] ?? '').length)));
  const fmt = (vals) => vals.map((v, i) => String(v ?? '').padEnd(larg[i])).join('  ');
  return [fmt(colunas), fmt(larg.map((n) => '-'.repeat(n))), ...linhas.map((l) => fmt(colunas.map((c) => l[c])))].join('\n');
};
