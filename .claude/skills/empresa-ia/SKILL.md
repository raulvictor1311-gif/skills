---
name: empresa-ia
description: Monta e opera a empresa de IA - 5 times, 10 agentes trabalhando e o dono só aprova. Vendas (SDR de IA, Qualificador, Agendador), Marketing (Gestor de Tráfego, Social Media), Financeiro (Caixa do Dia, Cobrança), Atendimento (Atendente de IA, Pós-venda) e Assistente Pessoal. Faz a entrevista da empresa, roda as rotinas da manhã, junta tudo numa fila "Para aprovar", executa só o que foi aprovado e mostra o painel. Use quando a pessoa pedir "monta os agentes da minha empresa", "funcionários de IA", "roda as rotinas", "o que tem pra aprovar", "aprova tudo", "painel da empresa", ou chamar /empresa-ia com iniciar, rotina, aprovar, executar, painel ou status.
license: MIT
---

# Empresa de IA: cinco times trabalhando, você só aprova

```
                     Você  ◀── resumo da manhã + "Para aprovar"
                       │
                Sua Empresa [IA]
   ┌─────────┬─────────┼──────────┬─────────────┐
 Vendas   Marketing  Financeiro  Atendimento  Assistente
 sdr-ia   gestor-    caixa-do-   atendente-ia  assistente-
 qualif.  trafego    dia         pos-venda     pessoal
 agendad. social-    cobranca
          media
```

Cada caixinha é um subagente em `.claude/agents/<nome>.md`. Eles **preparam**; você (o
orquestrador) junta, mostra ao dono e **executa só o que ele aprovou**. `<skill>` é a pasta
deste arquivo. A empresa mora em `~/empresa-ia` (ou `$EMPRESA_IA`).

## Modos

| Chamada | O que faz |
|---|---|
| `/empresa-ia` ou `iniciar` | Entrevista e monta a empresa (passo 1) |
| `/empresa-ia rotina [manha\|leads\|anuncios\|caixa\|semana]` | Roda os agentes da rotina (passo 2) |
| `/empresa-ia aprovar` | Mostra a fila e coleta as decisões (passo 3) |
| `/empresa-ia executar` | Executa o que está aprovado (passo 4) |
| `/empresa-ia painel` | Gera e mostra o painel (passo 5) |
| `/empresa-ia status` | `aprovar.mjs listar` + `diario.mjs ver`, em 10 linhas |
| "SDR, responde esses leads: …" | Chame só aquele agente com o que foi colado |

## Regras do orquestrador

- **Nada sai sem aprovação.** Só você chama ferramenta que manda algo para fora, e só depois de
  `node <skill>/scripts/aprovar.mjs pode-executar <id>` responder ✔. Os agentes nunca executam.
- **Autonomia é escolha do dono, por agente e por tipo**, no `empresa.json.autonomia`
  (ex.: `"assistente-pessoal": ["email"]`, `"sdr-ia": ["mensagem"]`). Comece tudo vazio.
  Ofereça ligar só depois de uma semana em que ele aprovou aquele tipo sem mudar nada.
- **"Para", "pausa", "segura"** → não execute mais nada no turno e diga o que ficou pendente.
- **Número só de conector ou arquivo.** Painel e resumo mostram "—" onde não há dado.
- **Chave nunca no chat.** Conectores ficam ligados no claude.ai (Gmail, Calendar, Stripe,
  Windsor.ai, Composio). Se faltar um, diga qual agente fica sem ele e siga com os outros.
- Recusa com motivo vira uma linha datada no `aprendizados.md`, na seção do time.

## 1. Iniciar (uma vez)

1. `node <skill>/scripts/iniciar.mjs` (cria as pastas, não sobrescreve nada).
2. **Entrevista numa mensagem só**, com exemplo em cada pergunta:
   1. Nome da empresa, o que vende e para quem.
   2. Ofertas com preço e link de pagamento (ou chave Pix).
   3. As 3 perguntas que separam um bom cliente, e quem você **não** atende.
   4. Agenda: dias e horários para reuniões, duração, link da reunião.
   5. FAQ: as 5 perguntas que mais chegam, com a resposta. Política de troca e reembolso.
   6. Seu e-mail para o resumo da manhã, e o tom (ex.: "próximo, sem gíria").
   7. Por onde chegam leads (WhatsApp, Instagram, e-mail, site) e onde roda anúncio.
3. Preencha `empresa.json`. O que ele não respondeu fica vazio; não invente.
4. **Conectores**: teste cada um com uma leitura pequena (ToolSearch para carregar):
   Gmail (`search_threads` 1 resultado), Calendar (`list_calendars`), Stripe, Windsor.ai
   (`get_connectors`), Composio (ToolSearch "composio instagram"). Mostre a tabela
   agente → conector → ✔/✖ e o que cada ✖ significa ("sem Windsor: o gestor de tráfego precisa
   do CSV do Gerenciador"). WhatsApp não tem conector nativo: sem ele, o SDR trabalha com as
   conversas que o dono cola ou exporta.
5. Ofereça agendar as rotinas (passo 6) e termine com o painel.

## 2. Rotinas

Chame os agentes com a ferramenta Agent (`subagent_type` = nome do agente). Os independentes
vão **em paralelo, na mesma mensagem**. Passe a cada um: o caminho da empresa, o que é dele
nesta rodada (ex.: "leads novos desde 06:00") e o que foi colado pelo dono, se houver.

| Rotina | Hora padrão | Agentes, em ordem |
|---|---|---|
| `leads` | 06:00 e a cada 2 h no horário comercial | `sdr-ia` ∥ `atendente-ia` → `qualificador` → `agendador` |
| `anuncios` | 07:00 | `gestor-trafego` |
| `caixa` | 08:00 | `caixa-do-dia` → `cobranca` → `pos-venda` |
| `manha` | 07:30 (depois das outras) | leads + anuncios + caixa, depois `assistente-pessoal` |
| `semana` | domingo 18:00 | `social-media` |

`→` = espere o anterior, porque ele entrega trabalho para o próximo (ex.: o qualificador pega
os leads que o SDR marcou). `∥` = em paralelo. O `assistente-pessoal` é sempre o último: ele
resume o que os outros fizeram.

Depois da rotina: `aprovar.mjs listar`, gere o painel e mostre ao dono a fila (passo 3).

## 3. Aprovar

Mostre a fila agrupada por time, cada item com: título, resumo de uma linha, e o `conteudo`
exato que vai sair (mensagem inteira, mudança de anúncio, valor da cobrança). Itens de risco
alto primeiro. Pergunte uma vez: "Aprovo todos, ou quer mudar algum?"

- "aprova tudo" → `aprovar.mjs aprovar todos`
- "aprova 1 e 3", "recusa o da Aurora porque já pagou" → `aprovar`/`recusar --motivo`
- "muda o texto do 2 para …" → edite o `conteudo` e a `acao` no JSON do item, mostre de novo,
  e só aprove quando ele confirmar.

Logo depois de aprovar, execute (passo 4) sem perguntar de novo.

## 4. Executar

Para cada item `aprovado`:

1. `aprovar.mjs pode-executar <id>`; se ✖, pule.
2. Com `acao`: carregue a ferramenta (ToolSearch `select:<ferramenta>`) e chame com os
   `parametros`. Ações do Windsor que pedem `confirmation_token`: rode a prévia, mostre o
   impacto e só confirme se bater com o aprovado.
   Sem `acao`: entregue o `conteudo` pronto para o dono copiar, e marque executado com
   `--resultado "entregue para envio manual"`.
3. Deu certo → `aprovar.mjs executado <id> --resultado "<id da mensagem/evento>"` e atualize o
   arquivo de `ref` (lead, cliente, venda) com o que saiu. Erro → `aprovar.mjs falhou <id>
   --erro "..."`, sem tentar de novo no mesmo turno.
4. Feche com 1 linha por time: "Vendas: 3 respostas enviadas, 1 reunião marcada (qui 15h)."

## 5. Painel

`node <skill>/scripts/painel.mjs` gera `saida/painel.html` (organograma, números de hoje, fila,
diário). Copie para a pasta de trabalho se o dono não consegue abrir `~`, e mande com
SendUserFile ou publique como Artifact se ele quiser abrir no celular.

## 6. Agendar as rotinas (opcional, só com o sim do dono)

Pergunte o fuso e crie tarefas agendadas que chamam `/empresa-ia rotina <nome>` nos horários da
tabela, com minuto quebrado (06:07, 07:13...) para não cair na hora cheia. Na sessão em nuvem
use `create_trigger`; no computador do dono, `/loop` ou o agendador que ele já usa. Lembre:
a rotina prepara e deixa na fila; nada sai até ele aprovar, a não ser o que ligou em autonomia.

## Arquivos da skill

- `REGRAS.md`: o que todo agente segue (aprovação, formatos de lead, atendimento, cliente).
- `scripts/aprovar.mjs`: fila (novo, listar, aprovar, recusar, pode-executar, executado, falhou).
- `scripts/diario.mjs`: registrar e ver o que andou e travou.
- `scripts/painel.mjs`, `scripts/iniciar.mjs`, `modelos/`.
