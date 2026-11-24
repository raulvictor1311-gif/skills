# fabrica-reels

Agente de Claude Code que resolve o "preciso postar todo dia, mas não dou conta de editar".
Você conta o problema uma vez e ele:

1. **Faz a pauta** de um lote (ex.: 50 reels), variando ângulo e formato.
2. **Roteiriza e escreve a legenda** de cada um (vários agentes `roteirista-reels` em paralelo).
3. **Renderiza tudo** em MP4 1080x1920 com a skill [`reel`](../reel) (Remotion, na sua máquina).
4. **Monta a semana** (ex.: 6 por dia até domingo) e uma vitrine para você revisar.
5. Espera você dizer **VAI**.
6. **Publica** no Instagram e no YouTube Shorts pelo conector Composio, nos horários.
7. **Mede** as visualizações e **anota o que funciona** em `o-que-funciona.md`.
8. O próximo lote nasce lendo esse arquivo: os próximos 50 saem mais afiados.

## Comandos

| Você diz | O que acontece |
|---|---|
| `/fabrica-reels` ou "faz 50 reels sobre X" | Lote novo, até a vitrine e o pedido de VAI |
| `VAI` | Agenda o YouTube e liga a publicação do Instagram |
| `/loop 30m /fabrica-reels publicar` | Publica o que vencer, a cada 30 min |
| `/fabrica-reels medir` | Puxa as visualizações (1x por dia) |
| `/fabrica-reels aprender` | Atualiza o `o-que-funciona.md` |
| `/fabrica-reels status` | Onde está cada reel |

## Precisa de

- A skill `reel` instalada ao lado desta, com o estúdio montado (`~/reels-estudio`).
- Node 18+.
- Para postar sozinho: **Composio** conectado ao Claude, com Instagram (conta profissional
  ligada a uma página do Facebook) e/ou YouTube.
- Para o Instagram: um lugar com link público para os MP4 (Supabase Storage, R2, S3), se a
  ferramenta do Composio não aceitar o arquivo direto.
- Opcional: chave do ElevenLabs no `.env` do estúdio, para narração.

## Onde fica cada coisa

```
~/reels-estudio/
├── lotes/<lote>/
│   ├── fila.json        fonte da verdade: etapa, horário, posts, métricas
│   ├── pauta.json
│   ├── agenda.md        a semana em tabela
│   ├── vitrine.html     todos os vídeos com legenda, para revisar
│   └── analise.md       saída do aprender.mjs
├── reels/<slug>/        cenas.json + post.json (+ public/ com narração)
├── out/<slug>.mp4
├── metricas.csv         todas as leituras, de todos os lotes
└── o-que-funciona.md    a memória da fábrica
```

## Scripts (Node puro, sem dependência)

- `fila.mjs`: cria o lote, adiciona a pauta, mostra status, registra VAI, posts, erros e métricas.
- `renderizar.mjs`: render em série, retoma de onde parou, com narração opcional.
- `agendar.mjs`: distribui os prontos em N horários por dia, no fuso da pessoa.
- `vitrine.mjs`: gera a página de revisão.
- `vencidos.mjs`: diz o que publicar agora (só de lote com VAI).
- `aprender.mjs`: cruza views com ângulo, formato, duração, horário, CTA e legenda.

## Limites

Os reels são tipográficos (não editam filmagem). A API do Instagram não agenda: alguém precisa
publicar na hora, por isso o loop. Nada é publicado sem o VAI.

Licença MIT.
