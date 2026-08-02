import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao PostgreSQL do Supabase!");

    // 1. Criar a tabela 'faturamento_guias'
    console.log("Criando a tabela 'faturamento_guias' se não existir...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.faturamento_guias (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        despachante_id uuid NOT NULL REFERENCES public.despachantes(id) ON DELETE CASCADE,
        valor_total numeric(10,2) NOT NULL DEFAULT 0.00,
        status text NOT NULL DEFAULT 'PENDENTE',
        data_pagamento timestamp with time zone,
        criado_em timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
      );
    `);
    console.log("Tabela 'faturamento_guias' criada/verificada!");

    // 2. Desabilitar RLS para acesso direto no localhost
    await client.query(`ALTER TABLE public.faturamento_guias DISABLE ROW LEVEL SECURITY;`);
    console.log("RLS desativado para public.faturamento_guias!");

  } catch (err) {
    console.error("Erro ao criar a tabela:", err);
  } finally {
    await client.end();
  }
}

run();
