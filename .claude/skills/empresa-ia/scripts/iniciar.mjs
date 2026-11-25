// Cria a pasta da empresa (uma vez). Não sobrescreve nada que já exista.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAIZ, PASTAS, caminho } from './_base.mjs';

const skill = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const p of PASTAS) fs.mkdirSync(caminho(p), { recursive: true });
const copiar = [
  ['modelos/empresa.json', 'empresa.json'],
  ['modelos/aprendizados.md', 'aprendizados.md'],
  ['modelos/lancamentos.csv', 'financeiro/lancamentos.csv'],
  ['modelos/vendas.csv', 'financeiro/vendas.csv'],
];
for (const [de, para] of copiar) {
  const destino = caminho(para);
  if (fs.existsSync(destino)) { console.log(`· ${para} já existe, mantido`); continue; }
  fs.copyFileSync(path.join(skill, de), destino);
  console.log(`✔ ${para}`);
}
console.log(`\nEmpresa em ${RAIZ}. Preencha empresa.json com a entrevista.`);
