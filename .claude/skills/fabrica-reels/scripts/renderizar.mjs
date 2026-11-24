#!/usr/bin/env node
/**
 * Renderiza em série todos os reels do lote que já têm cenas.json e ainda não têm MP4.
 * Usa o estúdio e os scripts da skill `reel` (checar e narrar). Pode parar e rodar de novo:
 * o que já tem MP4 é pulado.
 *
 *   node renderizar.mjs --lote semana-48
 *   node renderizar.mjs --lote semana-48 --narrar --simular   # mostra o custo total da narração
 *   node renderizar.mjs --lote semana-48 --narrar             # narra (ElevenLabs) e renderiza
 *   node renderizar.mjs --lote semana-48 --so slug1,slug2 --refazer
 *   node renderizar.mjs --lote semana-48 --concurrency 2 --escala 0.5
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  lerArgs, falhar, pastaLote, lerFila, salvarFila, etapaProducao, pastaReel, arquivoMp4, ESTUDIO, SKILL_REEL,
} from './_base.mjs';

const args = lerArgs();
const lote = pastaLote(args);
const fila = lerFila(lote);

if (!fs.existsSync(path.join(SKILL_REEL, 'scripts', 'checar.mjs'))) {
  falhar(`Não achei a skill "reel" em ${SKILL_REEL}. A fábrica usa o estúdio dela; instale as duas skills na mesma pasta.`);
}
if (!fs.existsSync(path.join(ESTUDIO, 'node_modules', 'remotion'))) {
  falhar(`O estúdio ainda não está montado. Rode uma vez:\n  cp -R "${path.join(SKILL_REEL, 'template')}/." "${ESTUDIO}" && cd "${ESTUDIO}" && npm install`);
}

const so = typeof args.so === 'string' ? new Set(args.so.split(',').map((s) => s.trim())) : null;
const alvo = fila.itens.filter((it) => {
  if (so && !so.has(it.slug)) return false;
  if (!fs.existsSync(path.join(pastaReel(it.slug), 'cenas.json'))) return false;
  return args.refazer || !fs.existsSync(arquivoMp4(it.slug));
});
if (!alvo.length) { console.log('Nada para renderizar: todo reel com cenas.json já tem MP4.'); process.exit(0); }

const node = process.execPath;
const rodar = (cmd, argv, mostrar = true) => {
  const r = spawnSync(cmd, argv, { cwd: ESTUDIO, encoding: 'utf8', stdio: mostrar ? 'inherit' : 'pipe', shell: process.platform === 'win32' });
  return r;
};

if (args.narrar && args.simular) {
  let total = 0;
  for (const it of alvo) {
    const r = rodar(node, [path.join(SKILL_REEL, 'scripts', 'narrar.mjs'), '--projeto', path.relative(ESTUDIO, pastaReel(it.slug)), '--simular'], false);
    const m = /caracteres:\s*(\d+)/i.exec((r.stdout || '') + (r.stderr || ''));
    const n = m ? Number(m[1]) : 0;
    total += n;
    console.log(`${it.slug}: ${n || '?'} caracteres${r.status ? ' (com erro no cenas.json)' : ''}`);
  }
  console.log(`\nTotal estimado: ${total} caracteres de crédito do ElevenLabs para ${alvo.length} reels.`);
  process.exit(0);
}

console.log(`Renderizando ${alvo.length} reels em ${ESTUDIO}/out …\n`);
const falhas = [];
const inicio = Date.now();
alvo.forEach((it, i) => {
  const rel = path.relative(ESTUDIO, pastaReel(it.slug));
  console.log(`\n[${i + 1}/${alvo.length}] ${it.slug}`);
  fs.mkdirSync(path.join(pastaReel(it.slug), 'public'), { recursive: true });

  if (args.narrar) {
    const n = rodar(node, [path.join(SKILL_REEL, 'scripts', 'narrar.mjs'), '--projeto', rel]);
    if (n.status) { falhas.push({ slug: it.slug, etapa: 'narrar' }); return; }
  }
  const c = rodar(node, [path.join(SKILL_REEL, 'scripts', 'checar.mjs'), '--projeto', rel]);
  if (c.status) { falhas.push({ slug: it.slug, etapa: 'checar' }); return; }

  const extra = [];
  if (args.concurrency) extra.push(`--concurrency=${args.concurrency}`);
  if (args.escala) extra.push(`--scale=${args.escala}`);
  const r = rodar('npx', ['remotion', 'render', 'Reel', `out/${it.slug}.mp4`, `--props=${rel}/cenas.json`, `--public-dir=${rel}/public`, ...extra]);
  if (r.status || !fs.existsSync(arquivoMp4(it.slug))) falhas.push({ slug: it.slug, etapa: 'render' });
});

for (const it of fila.itens) it.etapa = etapaProducao(it);
salvarFila(lote, fila);

const min = ((Date.now() - inicio) / 60000).toFixed(1);
console.log(`\n✔ ${alvo.length - falhas.length} de ${alvo.length} renderizados em ${min} min.`);
if (falhas.length) {
  console.log('✖ Falharam (corrija e rode de novo, o resto é pulado):');
  for (const f of falhas) console.log(`  - ${f.slug} (${f.etapa})`);
  process.exit(1);
}
