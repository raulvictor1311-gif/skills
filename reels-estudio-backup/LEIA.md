# Backup da fábrica de reels

Estado do lote (fila, legendas, roteiros) para retomar a publicação se a máquina da nuvem reiniciar.
Os MP4 ficam no Supabase (projeto reels-portfolio, bucket público `reels`); os links estão em `lotes/*/fila.json` (`hospedado`).

Restaurar: `mkdir -p ~/reels-estudio && cp -R reels-estudio-backup/. ~/reels-estudio/` e seguir com `/fabrica-reels publicar`.
