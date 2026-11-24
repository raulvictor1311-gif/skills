#!/usr/bin/env node
/**
 * Lista o que precisa ser publicado agora (JSON), para o passo "publicar".
 * Só entra reel de lote que recebeu o VAI, pronto, com horário vencido e ainda não publicado.
 *
 *   node vencidos.mjs                                # todos os lotes, todas as redes
 *   node vencidos.mjs --lote semana-48 --rede instagram
 *   node vencidos.mjs --rede youtube --tudo          # inclui os futuros (YouTube agenda sozinho com publishAt)
 *   node vencidos.mjs --antecedencia 10              # inclui o que vence nos próximos 10 min
 *
 * Erros: um item que falhou volta para a lista até 3 tentativas; depois disso fica de fora
 * e aparece em "desistidos", para a pessoa resolver.
 */
import fs from 'node:fs';
import {
  lerArgs, falhar, pastaLote, todosLotes, lerFila, etapaProducao, lerPost, arquivoMp4, local,
} from './_base.mjs';

const args = lerArgs();
const lotes = args.lote ? [pastaLote(args)] : todosLotes();
const antecedencia = Number(args.antecedencia || 5) * 60 * 1000;
const agora = Date.now();
const MAX_TENTATIVAS = 3;

const saida = { agora: new Date(agora).toISOString(), publicar: [], desistidos: [], semVai: [] };

for (const lote of lotes) {
  const fila = lerFila(lote);
  const redes = args.rede ? [args.rede].filter((r) => fila.redes.includes(r)) : fila.redes;
  if (args.rede && !redes.length) continue;
  if (!fila.aprovadoEm) { saida.semVai.push(fila.lote); continue; }
  for (const it of fila.itens) {
    if (!it.horario || etapaProducao(it) !== 'pronto') continue;
    const t = new Date(it.horario).getTime();
    for (const r of redes) {
      const st = it.redes[r];
      const vence = args.tudo && r === 'youtube' ? true : t <= agora + antecedencia;
      if (!vence || st.status === 'postado' || st.status === 'agendado') continue;
      if (st.status === 'erro' && (st.tentativas || 0) >= MAX_TENTATIVAS) {
        saida.desistidos.push({ lote: fila.lote, slug: it.slug, rede: r, erro: st.erro });
        continue;
      }
      const post = lerPost(it.slug) || {};
      const mp4 = arquivoMp4(it.slug);
      saida.publicar.push({
        lote: fila.lote,
        slug: it.slug,
        rede: r,
        horario: it.horario,
        horarioLocal: local(it.horario, fila.fuso).curta,
        atrasoMin: Math.max(0, Math.round((agora - t) / 60000)),
        futuro: t > agora + antecedencia,
        mp4,
        mp4Existe: fs.existsSync(mp4),
        urlPublica: it.hospedado,
        legenda: post.legenda || null,
        youtube: r === 'youtube' ? { titulo: post.tituloYoutube || null, descricao: post.descricaoYoutube || post.legenda || null } : undefined,
        tentativasAnteriores: st.tentativas || 0,
      });
    }
  }
}

saida.publicar.sort((a, b) => a.horario.localeCompare(b.horario));
if (!lotes.length) falhar('Nenhum lote encontrado em ~/reels-estudio/lotes.');
console.log(JSON.stringify(saida, null, 2));
