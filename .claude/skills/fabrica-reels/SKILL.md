---
name: fabrica-reels
description: Agente que produz, agenda, publica e aprende com reels em lote. A pessoa conta o pepino ("preciso postar todo dia e não dou conta de editar") e o Claude faz a pauta, roteiriza e renderiza dezenas de reels com legenda, monta a semana (ex.: 6 por dia até domingo), espera a pessoa dizer VAI, publica no Instagram e no YouTube pelo conector (Composio), acompanha as visualizações e anota o que funciona para o próximo lote sair melhor. Use quando a pessoa pedir "faz 50 reels", "agenda minha semana de reels", "posta por mim", "reels em lote", "fábrica de conteúdo", ou chamar /fabrica-reels com publicar, medir, aprender ou status.
license: MIT
---

# Fábrica de reels: do pepino ao post, sozinha

A pessoa diz uma vez qual é o problema. Você devolve **um lote inteiro de reels prontos**, com
legenda e horário. Ela olha, diz **VAI**, e a partir daí você publica nos horários, mede o que
rendeu e escreve no `o-que-funciona.md` o que repetir. O lote seguinte já nasce com isso.

```
pauta → roteiro + legenda → render → vitrine e agenda → VAI → publicar → medir → aprender ─┐
  ▲                                                                                          │
  └──────────────────────────── o-que-funciona.md ◀──────────────────────────────────────────┘
```

`<skill>` é a pasta deste SKILL.md. `<reel>` é a pasta da skill `reel` (ao lado desta), que
faz cada vídeo. O estúdio fica em `~/reels-estudio` (ou em `$REELS_ESTUDIO`).

## Modos

| Chamada | O que faz |
|---|---|
| `/fabrica-reels` ou "faz N reels…" | Lote novo: passos 1 a 6 |
| `/fabrica-reels publicar` | Publica o que venceu (passo 7). É o que roda no loop |
| `/fabrica-reels medir` | Puxa visualizações dos posts (passo 8) |
| `/fabrica-reels aprender` | Analisa e atualiza o `o-que-funciona.md` (passo 9) |
| `/fabrica-reels status` | `node <skill>/scripts/fila.mjs status --lote <lote>` e resumo |

## Regras que valem em todos os passos

- **Nada sai sem o VAI.** Publicar, subir vídeo para um link público, agendar no YouTube:
  só depois que a pessoa disse VAI para aquele lote (`fila.mjs vai`). Os scripts conferem isso.
  "Pausa", "para" ou "segura" → `fila.mjs pausar` na hora.
- **Não invente número.** Visualização só entra se veio do conector. Sem conector, diga que
  não dá para medir e peça os números ou o print.
- **Chaves nunca no chat.** ElevenLabs fica no `.env` do estúdio; Instagram e YouTube ficam
  conectados no Composio, fora daqui.
- Promessa só do que é verdade, nos roteiros e nas legendas (mesmas regras das skills `reel` e
  `legenda`).
- A fila (`fila.json`) é a fonte da verdade. Toda publicação, erro e métrica passa pelos
  comandos de `fila.mjs`, nunca por edição à mão.

## Pré-requisitos (confira no começo do lote novo, sem interrogar)

1. **Node 18+** e o **estúdio da skill `reel`** montado uma vez:
   `cp -R <reel>/template/. ~/reels-estudio && cd ~/reels-estudio && npm install`.
2. **Conector Composio** com **Instagram** (conta Profissional, Criador ou Empresa, ligada a
   uma página do Facebook) e/ou **YouTube**. Procure as ferramentas com a busca de
   ferramentas (termos "instagram", "youtube", "composio"). Se não houver, o lote é produzido e
   agendado mesmo assim; explique que para postar sozinho falta conectar (composio.dev, plano
   grátis) e que, sem isso, você entrega os MP4 e legendas na ordem para ela postar.
3. **Link público para os MP4 (só Instagram).** A API do Instagram puxa o vídeo de uma URL
   `https`. Se a ferramenta do Composio aceitar o arquivo direto, ótimo. Se não, use um
   armazenamento que a pessoa já tenha (bucket público no Supabase Storage, Cloudflare R2, S3).
   Pergunte qual; nunca suba vídeo para serviço que ela não escolheu.

## 1. Entrevista (uma mensagem só)

Leia antes `~/reels-estudio/o-que-funciona.md`, se existir, e diga em uma linha o que vai
aproveitar dele. Pergunte só o que faltar, com padrão entre parênteses:

1. **Perfil e nicho**, e **público** (iniciante no assunto).
2. **Quantos reels e o ritmo**: (50 reels, 6 por dia, começando amanhã, fuso America/Sao_Paulo).
   Horários preferidos? (09:00, 11:30, 14:00, 16:30, 19:00, 21:30)
3. **Redes**: (Instagram e YouTube Shorts).
4. **CTA do lote**: palavra que a pessoa comenta e o que recebe (ex.: "Comenta GUIA…"). Pode
   variar por reel; diga se quer variar.
5. **Tom e visual**: (direto; tema escuro com destaque laranja). Voz ElevenLabs? Trilha?
6. **Material de base** (opcional): posts antigos, aula, lista de dúvidas dos seguidores.

Crie o lote: `node <skill>/scripts/fila.mjs novo --lote <nome> --fuso <fuso> --redes instagram,youtube`.
Nome curto e datado, ex.: `semana-48`.

## 2. Pauta

Escreva `~/reels-estudio/lotes/<lote>/pauta.json`: uma lista com N ideias.

```json
[{ "gancho": "Posta todo dia e ninguém vê?", "angulo": "dor", "formato": "lista",
   "ideia": "3 motivos de alcance baixo e o ajuste de cada um", "cta": "GUIA" }]
```

- `angulo` do gancho, de uma lista fixa para dar para comparar depois: `dor`, `número`,
  `contra o senso comum`, `consequência`, `pergunta`, `bastidor`, `antes-depois`, `mito`.
- `formato` = o miolo do reel: `lista`, `numero`, `antes-depois`, `titulo`, ou combinação
  (`titulo+lista`).
- **Variedade de propósito**: nenhum ângulo com mais de 30% do lote, nenhum gancho parecido
  com outro. Se o `o-que-funciona.md` tem regra **confirmada**, ~60% do lote segue as regras
  e ~40% testa coisa nova (senão a fábrica para de aprender).
- Gancho com até 7 palavras faladas, mesmas regras da skill `reel`.

Mostre a pauta compacta (número, ângulo, gancho; uma linha cada) e peça **um** ok. Se a pessoa
disse "só faz", siga. Depois: `node <skill>/scripts/fila.mjs adicionar --lote <lote> --arquivo <pauta.json>`.

## 3. Roteiro e legenda de cada reel

Para cada item da fila, na pasta `~/reels-estudio/reels/<slug>/`:

- `cenas.json` no formato da skill `reel` (leia `<reel>/SKILL.md`: tipos de cena, 20 a 45 s,
  fala contínua, última cena `cta`). Use as cores e fontes do lote em todos.
- `post.json`:
  ```json
  { "legenda": "primeira linha ≤125 caracteres\n\ncorpo…\n\nComenta GUIA que eu te mando…\n\n#a #b #c",
    "tituloYoutube": "até 100 caracteres, sem clickbait que o vídeo não cumpre",
    "descricaoYoutube": "2 a 4 linhas + as mesmas hashtags + #shorts" }
  ```
  Legenda com as regras da skill `legenda` (primeira linha que funciona cortada, corpo
  escaneável, um CTA, 3 a 5 hashtags de nicho), mas **sem** as 3 opções: escolha a melhor.

**Divida o trabalho.** Com 10 reels ou mais, use o agente `roteirista-reels` (em
`.claude/agents/`) em paralelo, 8 a 10 reels por agente, todos de uma vez. Passe a cada um:
pasta do lote, os slugs dele, perfil/público/tom/cores/CTA, e o caminho do `o-que-funciona.md`.
Sem esse agente, faça você mesmo, em sequência.

Depois: `node <skill>/scripts/fila.mjs status --lote <lote>`. Todo reel deve estar em
`roteirizado`. Os que não estiverem, conserte.

## 4. Render em lote

```bash
node <skill>/scripts/renderizar.mjs --lote <lote> --narrar --simular   # só com voz: custo total
node <skill>/scripts/renderizar.mjs --lote <lote> [--narrar]           # roda tudo, retoma de onde parou
```

- Com voz, mostre o total de caracteres e **peça ok antes** (gasta crédito da pessoa).
- 50 reels levam de 1 a 3 horas. Rode em segundo plano e avise o tempo estimado. Máquina
  fraca: `--concurrency 2`.
- Antes do lote todo, renderize **um** (`--so <slug>`), olhe 3 quadros como manda a skill
  `reel` e só então solte o resto. Se o primeiro tiver problema, todos teriam.
- Falhou algum? O script lista; corrija o `cenas.json` e rode de novo.

## 5. Vitrine e agenda

```bash
node <skill>/scripts/agendar.mjs --lote <lote> --por-dia 6 [--inicio AAAA-MM-DD] [--horarios 09:00,12:00,…]
node <skill>/scripts/vitrine.mjs --lote <lote>
```

Entregue: o caminho da `vitrine.html` (abre no navegador, mostra os vídeos com legenda e
horário), a tabela da `agenda.md` e um resumo de 3 linhas (quantos, de quando a quando, quantos
por dia, quais redes). Termine com: **"Revisa e me diz VAI que eu agendo tudo."**

Se ela pedir para trocar algo: edite o `cenas.json`/`post.json`, rode `renderizar.mjs --so
<slug> --refazer` e a vitrine de novo.

## 6. O VAI

Quando a pessoa disser VAI (ou "pode postar", "manda"):

1. `node <skill>/scripts/fila.mjs vai --lote <lote>`.
2. **Instagram, se precisar de link:** suba cada MP4 para o armazenamento escolhido e grave
   `fila.mjs hospedado --slug <slug> --url <https…>`. Confira que a URL abre o vídeo.
3. **YouTube agenda sozinho:** `node <skill>/scripts/vencidos.mjs --lote <lote> --rede youtube --tudo`
   e, para cada um, envie com `privacyStatus: "private"` e `publishAt` = `horario` do item
   (o YouTube publica na hora). Grave `fila.mjs agendado --rede youtube --id <id> --url <url>`.
   Se a ferramenta não aceitar `publishAt`, ele fica para o loop do passo 7, como o Instagram.
4. **Instagram não agenda pela API**: alguém precisa publicar na hora. Monte o loop:
   - Claude Code aberto: `/loop 30m /fabrica-reels publicar`.
   - Ou uma tarefa agendada a cada 30 min com o prompt `/fabrica-reels publicar`, rodando
     onde estão o estúdio e o conector.
   Explique em uma frase que, se o computador dormir, os posts atrasam e saem no próximo ciclo.
5. Responda curto, como no vídeo: "Agendado. N reels, X por dia até <dia>. Te aviso de erro."

## 7. Publicar (`/fabrica-reels publicar`)

```bash
node <skill>/scripts/vencidos.mjs
```

O JSON traz `publicar` (o que venceu), `desistidos` (3 erros seguidos) e `semVai`. Para cada
item de `publicar`, em ordem:

**Instagram (Reels)**, pelas ferramentas do Composio (os nomes exatos variam; costumam ser
algo como `INSTAGRAM_CREATE_MEDIA_CONTAINER` → `INSTAGRAM_GET_POST_STATUS` → `INSTAGRAM_CREATE_POST`):
1. Criar o contêiner: `media_type: "REELS"`, `video_url: urlPublica`, `caption: legenda`,
   `share_to_feed: true`.
2. Esperar o status `FINISHED` (cheque a cada 20–30 s, até ~5 min). `ERROR` → registre erro.
3. Publicar o contêiner. Pegue o id e o permalink.
4. `fila.mjs postado --lote <lote> --slug <slug> --rede instagram --id <id> --url <permalink>`.

**YouTube (Shorts)** que não foi agendado no passo 6: enviar o MP4 (`mp4`) com `titulo`,
`descricao`, `privacyStatus: "public"`, categoria do nicho; `fila.mjs postado --rede youtube …`.

Erro em qualquer passo: `fila.mjs erro --rede <rede> --slug <slug> --msg "<mensagem curta>"`
e siga para o próximo. Ele volta no próximo ciclo, até 3 tentativas. Erros comuns: token
expirado (reconectar no Composio), limite diário de posts da API, URL do vídeo não pública,
vídeo fora do padrão (o render da skill `reel` já sai 1080x1920 H.264).

No fim do ciclo, uma linha: "Postei 2 (09:00 e 11:30). Próximo às 14:00." Se houver
`desistidos`, avise a pessoa com o erro de cada um. Sem nada vencido: não diga nada além de
"nada para postar agora".

## 8. Medir (`/fabrica-reels medir`)

Uma vez por dia basta. Para cada reel `postado` há mais de 24 h e menos de 14 dias, sem
leitura nas últimas 20 h:

- **Instagram**: insights da mídia (ferramenta tipo `INSTAGRAM_GET_IG_MEDIA_INSIGHTS`), métricas
  `views`, `reach`, `likes`, `comments`, `saved`, `shares`.
- **YouTube**: estatísticas do vídeo (`viewCount`, `likeCount`, `commentCount`).

Grave cada leitura: `fila.mjs metricas --lote <lote> --slug <slug> --rede <rede> --views N
--alcance N --curtidas N --comentarios N --salvamentos N --compartilhamentos N` (só os campos
que vieram). Isso também alimenta `~/reels-estudio/metricas.csv`.

Resumo para a pessoa: total de views do lote até agora, os 3 melhores e os 3 piores, em
linguagem simples.

## 9. Aprender (`/fabrica-reels aprender`)

Rode quando houver pelo menos ~15 reels medidos com 48 h, e sempre antes de um lote novo.

```bash
node <skill>/scripts/aprender.mjs --min-horas 48
```

Leia o `analise.md`, assista mentalmente aos 5 melhores e 5 piores (abra os `cenas.json` e
`post.json` deles) e atualize `~/reels-estudio/o-que-funciona.md` (modelo em
`<skill>/modelos/o-que-funciona.md`):

- **Confirmado**: padrão com índice ≥ 1,3 (ou ≤ 0,7, para "evitar") em grupo com n ≥ 3, que
  repetiu em mais de um lote ou tem explicação clara no conteúdo dos reels.
- **Hipótese**: pista com n pequeno. Vira teste no próximo lote.
- Cada linha diz o que fazer, a evidência (n, índice, lote) e um exemplo de gancho real.
- No máximo ~15 linhas no total. Regra que parou de funcionar sai; não acumule.
- Separe Instagram e YouTube quando divergirem.

Diga à pessoa o que mudou no arquivo, em 3 bullets: "Os próximos 50 saem com isso."

## O que esta skill não faz

- Não edita filmagem: os reels são tipográficos (skill `reel`). Se a pessoa grava vídeos, ela
  ainda precisa de outra ferramenta para cortar as falas dela.
- Não publica sem conector nem sem o VAI, e não posta fora dos horários combinados.
- Não promete views: o `o-que-funciona.md` mostra tendência do próprio perfil, não garantia.
- Não responde comentários (para isso existe a skill `comentarios`).
