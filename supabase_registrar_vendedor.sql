-- ============================================================
-- Registra o catálogo Havaianas (você) na tabela "vendedores"
-- compartilhada (a mesma usada pelo Impala e pelo Nadir) — é essa
-- linha que controla se o catálogo fica ativo ou pausado.
-- Rode isso UMA VEZ, depois de rodar o supabase_setup_havaianas.sql.
-- ============================================================

insert into vendedores (slug, ativo)
values ('havaianas-leonardo', true)
on conflict (slug) do update set
  ativo = excluded.ativo;
