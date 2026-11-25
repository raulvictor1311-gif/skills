# empresa-ia

Os agentes de IA que toda empresa deve ter: 5 times, 10 agentes, e o dono só aprova.

| Time | Agente | Faz |
|---|---|---|
| Vendas | `sdr-ia` | responde o lead em segundos e começa a qualificação |
| Vendas | `qualificador` | conduz as perguntas, dá nota, separa quem tem fit |
| Vendas | `agendador` | acha horário livre e marca a reunião na agenda |
| Marketing | `gestor-trafego` | cruza venda × anúncio, propõe cortar o caro e reforçar o que vende |
| Marketing | `social-media` | entrega os posts da semana prontos |
| Financeiro | `caixa-do-dia` | confere o caixa toda manhã (banco/Stripe × vendas) |
| Financeiro | `cobranca` | prepara a cobrança de quem atrasou, no dia certo |
| Atendimento | `atendente-ia` | responde na hora com o histórico do cliente |
| Atendimento | `pos-venda` | boas-vindas, check-in, avaliação, renovação |
| Assistente | `assistente-pessoal` | agenda, e-mails e o resumo da manhã |

Os agentes ficam em `.claude/agents/`; a skill `empresa-ia` coordena as rotinas, a fila
"Para aprovar" e o painel. Comece com `/empresa-ia`.

Nada sai sem aprovação: os agentes criam itens em `aprovar/`, e só o orquestrador executa,
depois do "aprovado" do dono (ou da autonomia que ele ligou para aquele tipo de ação).
