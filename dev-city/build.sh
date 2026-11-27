#!/bin/sh
# Monta o site para a Vercel.
# - index.html é o mesmo arquivo usado no artifact do Claude (sem <head>): aqui ganha o documento completo.
# - cidade.html já é um documento completo e data.js é compartilhado pelas duas páginas.
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist
{
  printf '%s\n' '<!doctype html>' '<html lang="pt-BR">' '<head>' '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' \
    '<meta name="description" content="Explore a Costa Solar. Escolha seu caminho. Aprenda programação completando missões.">' \
    '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>' \
    '</head>' '<body>'
  cat index.html
  printf '%s\n' '</body>' '</html>'
} > dist/index.html
cp cidade.html data.js dist/
