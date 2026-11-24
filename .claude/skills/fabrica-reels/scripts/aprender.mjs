#!/usr/bin/env node
/**
 * Cruza as visualizações de cada reel com as características dele (ângulo do gancho, formato,
 * tamanho do gancho, duração, horário, CTA, narração, tamanho da legenda) e diz o que está
 * acima e abaixo da mediana. Gera analise.md; quem escreve o o-que-funciona.md é o Claude,
 * com julgamento, a partir daqui.
 *
 *   node aprender.mjs                       # todos os lotes
 *   node aprender.mjs --lote semana-48
 *   node aprender.mjs --rede instagram --min-horas 48
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  lerArgs, pastaLote, todosLotes, lerFila, pastaReel, lerPost, local, ESTUDIO, falhar,
} from './_base.mjs';

const args = lerArgs();
const lotes = args.lote ? [pastaLote(args)] : todosLotes();
if (!lotes.length) falhar('Nenhum lote encontrado.');
const minHoras = Number(args['min-horas'] || 24);

const mediana = (v) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const faixa = (n, cortes, nomes) => nomes[cortes.findIndex((c) => n <= c) === -1 ? nomes.length - 1 : cortes.findIndex((c) => n <= c)];

const linhas = [];
for (const lote of lotes) {
  const fila = lerFila(lote);
  const redes = args.rede ? [args.rede] : fila.redes;
  for (const it of fila.itens) {
    let cenas = null;
    try { cenas = JSON.parse(fs.readFileSync(path.join(pastaReel(it.slug), 'cenas.json'), 'utf8')); } catch { /* sem cenas */ }
    const post = lerPost(it.slug) || {};
    const fala = cenas ? cenas.cenas.map((c) => c.fala || '').join(' ') : '';
    const seg = fala ? fala.split(/\s+/).length / 2.9 : 0;
    const ganchoPal = it.gancho.split(/\s+/).length;
    const primeira = (post.legenda || '').split('\n')[0];
    for (const r of redes) {
      const st = it.redes?.[r];
      if (!st || st.status !== 'postado' || !st.em) continue;
      const validas = (it.metricas?.[r] || []).filter((m) => (new Date(m.em) - new Date(st.em)) / 3.6e6 >= minHoras);
      if (!validas.length) continue;
      const ult = validas[validas.length - 1];
      const l = it.horario ? local(it.horario, fila.fuso) : null;
      linhas.push({
        lote: fila.lote, slug: it.slug, gancho: it.gancho, rede: r, views: ult.views,
        salvamentos: ult.salvamentos, compartilhamentos: ult.compartilhamentos, comentarios: ult.comentarios,
        attrs: {
          'ângulo do gancho': it.angulo || '(sem)',
          formato: it.formato || (cenas ? cenas.cenas.map((c) => c.tipo).filter((t) => t !== 'gancho' && t !== 'cta').join('+') : '(sem)'),
          'palavras no gancho': faixa(ganchoPal, [4, 6, 8], ['até 4', '5-6', '7-8', '9+']),
          duração: faixa(seg, [20, 30, 40], ['até 20 s', '21-30 s', '31-40 s', '41 s+']),
          'faixa de horário': l ? faixa(Number(l.hora.slice(0, 2)), [10, 13, 17, 20], ['manhã cedo (até 10h)', 'fim da manhã', 'tarde', 'fim de tarde', 'noite (21h+)']) : '(sem)',
          'dia da semana': l ? l.semana : '(sem)',
          'palavra do CTA': (cenas?.cenas.find((c) => c.tipo === 'cta')?.palavra || it.cta || '(sem)').toUpperCase(),
          narração: cenas?.narracao ? 'com voz' : 'sem voz',
          'primeira linha da legenda': primeira ? faixa(primeira.length, [60, 100, 125], ['até 60 car.', '61-100', '101-125', '126+ (corta)']) : '(sem)',
        },
      });
    }
  }
}

let md = `# O que os números dizem\n\nGerado em ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · leituras com pelo menos ${minHoras} h de post.\n\n`;
if (!linhas.length) {
  md += 'Ainda não há reel postado com métrica registrada depois desse prazo. Rode o passo "medir" antes.\n';
} else {
  for (const rede of [...new Set(linhas.map((l) => l.rede))]) {
    const ls = linhas.filter((l) => l.rede === rede).sort((a, b) => b.views - a.views);
    const med = mediana(ls.map((l) => l.views));
    md += `## ${rede}: ${ls.length} reels medidos · mediana ${Math.round(med)} views\n\n`;
    md += '### Melhores\n\n' + ls.slice(0, 5).map((l) => `- ${l.views} views · ${l.gancho} (\`${l.slug}\`)`).join('\n') + '\n\n';
    if (ls.length > 5) md += '### Piores\n\n' + ls.slice(Math.max(5, ls.length - 5)).reverse().map((l) => `- ${l.views} views · ${l.gancho} (\`${l.slug}\`)`).join('\n') + '\n\n';
    md += '### Por característica\n\n_Índice = mediana do grupo ÷ mediana geral. Acima de 1,3 ou abaixo de 0,7 com n ≥ 3 merece atenção; com n < 3 é só pista._\n\n';
    for (const attr of Object.keys(ls[0].attrs)) {
      const grupos = new Map();
      for (const l of ls) { const v = l.attrs[attr]; if (!grupos.has(v)) grupos.set(v, []); grupos.get(v).push(l.views); }
      if (grupos.size < 2) continue;
      md += `**${attr}**\n\n| valor | n | mediana | índice |\n|---|---|---|---|\n`;
      for (const [v, vs] of [...grupos.entries()].sort((a, b) => mediana(b[1]) - mediana(a[1]))) {
        const idx = med ? mediana(vs) / med : 0;
        md += `| ${v} | ${vs.length} | ${Math.round(mediana(vs))} | ${idx.toFixed(2)}${vs.length >= 3 && (idx >= 1.3 || idx <= 0.7) ? ' ◀' : ''} |\n`;
      }
      md += '\n';
    }
  }
}

const destino = args.lote ? path.join(lotes[0], 'analise.md') : path.join(ESTUDIO, 'analise.md');
fs.writeFileSync(destino, md);
console.log(md);
console.log(`✔ Gravado em ${destino}`);
