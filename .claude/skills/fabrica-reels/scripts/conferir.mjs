#!/usr/bin/env node
/**
 * Lista os posts marcados como enviados mas ainda não conferidos (id A-CONFIRMAR ou sem "confirmado"),
 * com a primeira linha da legenda, para comparar com os posts que o conector devolve.
 *   node conferir.mjs                       # JSON com o que falta conferir
 *   node conferir.mjs --ok --lote X --slug S --rede instagram --url https://...   # marca como confirmado
 */
import { lerArgs, todosLotes, pastaLote, lerFila, salvarFila, lerPost, falhar } from './_base.mjs';
const args = lerArgs();
if (args.ok) {
  const lote = pastaLote(args); const f = lerFila(lote);
  const it = f.itens.find((i) => i.slug === args.slug); if (!it) falhar('slug não encontrado');
  const r = it.redes[args.rede]; if (!r) falhar('rede não encontrada');
  r.confirmado = new Date().toISOString(); if (typeof args.url === 'string') r.url = args.url;
  if (r.id === 'A-CONFIRMAR-timeout' || r.id === 'A-CONFIRMAR') r.id = typeof args.id === 'string' ? args.id : null;
  salvarFila(lote, f); console.log(`✔ ${it.slug} → ${args.rede}: confirmado`); process.exit(0);
}
const out = [];
for (const lote of todosLotes()) {
  const f = lerFila(lote);
  for (const it of f.itens) for (const [rede, r] of Object.entries(it.redes)) {
    if (rede === 'tiktok' || r.status !== 'postado' || r.confirmado) continue;
    const leg = (lerPost(it.slug)?.legenda || '').split('\n')[0];
    out.push({ lote: f.lote, conta: f.conta?.[rede] || null, slug: it.slug, rede, enviadoEm: r.em,
      horasDesdeEnvio: Math.round((Date.now() - new Date(r.em)) / 36e5 * 10) / 10, primeiraLinha: leg });
  }
}
console.log(JSON.stringify(out, null, 2));
