#!/usr/bin/env node
/**
 * Gera vitrine.html no lote: todos os reels lado a lado, com vídeo, horário e legenda,
 * para a pessoa revisar antes de dizer VAI. Abre no navegador direto do disco.
 *
 *   node vitrine.mjs --lote semana-48
 */
import fs from 'node:fs';
import path from 'node:path';
import { lerArgs, pastaLote, lerFila, etapaProducao, arquivoMp4, lerPost, local } from './_base.mjs';

const args = lerArgs();
const lote = pastaLote(args);
const fila = lerFila(lote);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const cards = fila.itens.map((it) => {
  const etapa = etapaProducao(it);
  const post = lerPost(it.slug) || {};
  const mp4 = path.relative(lote, arquivoMp4(it.slug)).split(path.sep).join('/');
  const video = fs.existsSync(arquivoMp4(it.slug))
    ? `<video src="${esc(mp4)}" controls preload="metadata" playsinline></video>`
    : `<div class="vazio">${esc(etapa)}</div>`;
  const redes = fila.redes.map((r) => `<span class="st ${esc(it.redes[r].status)}">${esc(r)}: ${esc(it.redes[r].status)}</span>`).join(' ');
  return `<article>
  ${video}
  <div class="info">
    <div class="topo"><b>#${it.n}</b><span>${it.horario ? esc(local(it.horario, fila.fuso).curta) : 'sem horário'}</span></div>
    <h2>${esc(it.gancho)}</h2>
    <p class="meta">${esc(it.angulo)}${it.formato ? ' · ' + esc(it.formato) : ''}</p>
    <details><summary>Legenda</summary><pre>${esc(post.legenda || '(sem post.json)')}</pre>${post.tituloYoutube ? `<p><b>YouTube:</b> ${esc(post.tituloYoutube)}</p>` : ''}</details>
    <div class="redes">${redes}</div>
    <code>${esc(it.slug)}</code>
  </div>
</article>`;
}).join('\n');

const prontos = fila.itens.filter((it) => etapaProducao(it) === 'pronto').length;
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lote ${esc(fila.lote)}</title>
<style>
:root{--fundo:#121110;--cartao:#1d1b19;--texto:#f3efe9;--suave:#a39d95;--destaque:#f07a2a;--ok:#4cc38a;--erro:#ef5d5d}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--texto);font:15px/1.45 system-ui,sans-serif;padding:24px 16px}
header{max-width:1400px;margin:0 auto 20px}h1{margin:0 0 4px;font-size:28px}h1 span{color:var(--destaque)}
header p{margin:0;color:var(--suave)}
main{max-width:1400px;margin:0 auto;display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
article{background:var(--cartao);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
video,.vazio{width:100%;aspect-ratio:9/16;background:#000;display:block;object-fit:cover}
.vazio{display:grid;place-items:center;color:var(--suave)}
.info{padding:12px;display:flex;flex-direction:column;gap:6px}
.topo{display:flex;justify-content:space-between;color:var(--suave);font-size:13px}.topo b{color:var(--destaque)}
h2{font-size:16px;margin:0}.meta{margin:0;color:var(--suave);font-size:13px}
details pre{white-space:pre-wrap;font:13px/1.45 system-ui,sans-serif;background:#0003;padding:8px;border-radius:8px;margin:6px 0 0}
summary{cursor:pointer;color:var(--suave);font-size:13px}
.redes{display:flex;gap:6px;flex-wrap:wrap}.st{font-size:12px;padding:2px 8px;border-radius:99px;background:#fff1}
.st.postado,.st.agendado{background:color-mix(in srgb,var(--ok) 25%,transparent)}.st.erro{background:color-mix(in srgb,var(--erro) 30%,transparent)}
code{font-size:11px;color:var(--suave);word-break:break-all}
</style></head><body>
<header><h1>Lote <span>${esc(fila.lote)}</span></h1>
<p>${fila.itens.length} reels · ${prontos} prontos · ${fila.aprovadoEm ? 'VAI dado em ' + esc(local(fila.aprovadoEm, fila.fuso).curta) : 'esperando o VAI'} · fuso ${esc(fila.fuso)}</p></header>
<main>
${cards}
</main></body></html>
`;
const arq = path.join(lote, 'vitrine.html');
fs.writeFileSync(arq, html);
console.log(`✔ Vitrine em ${arq}`);
