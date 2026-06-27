import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao Postgres do Supabase para atualizar a constraint de status_conciliacao.");

    // Drop da constraint antiga
    console.log("Drop da constraint transacoes_status_conciliacao_check antiga...");
    await client.query("ALTER TABLE public.transacoes DROP CONSTRAINT IF EXISTS transacoes_status_conciliacao_check;");

    // Criar a nova constraint com os valores usados no frontend e também os antigos
    console.log("Criando nova constraint transacoes_status_conciliacao_check com valores [PAID, PENDING, CANCELLED, CONCILIADO, DIVERGENTE, PENDENTE]...");
    await client.query(`
      ALTER TABLE public.transacoes 
      ADD CONSTRAINT transacoes_status_conciliacao_check 
      CHECK (status_conciliacao = ANY (ARRAY['PAID'::text, 'PENDING'::text, 'CANCELLED'::text, 'CONCILIADO'::text, 'DIVERGENTE'::text, 'PENDENTE'::text]));
    `);

    console.log("Constraint de status atualizada com sucesso!");
  } catch (err) {
    console.error("Erro ao atualizar constraint:", err);
  } finally {
    await client.end();
  }
}

run();
