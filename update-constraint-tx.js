import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao Postgres do Supabase para atualizar a constraint de forma_pagamento.");

    // Drop da constraint antiga
    console.log("Drop da constraint transacoes_forma_pagamento_check antiga...");
    await client.query("ALTER TABLE public.transacoes DROP CONSTRAINT IF EXISTS transacoes_forma_pagamento_check;");

    // Criar a nova constraint com os valores reais enviados pelo frontend
    console.log("Criando nova constraint transacoes_forma_pagamento_check com valores [CASH, PIX, CREDIT_CARD, DEBIT_CARD, BOLETO]...");
    await client.query(`
      ALTER TABLE public.transacoes 
      ADD CONSTRAINT transacoes_forma_pagamento_check 
      CHECK (forma_pagamento = ANY (ARRAY['CASH'::text, 'PIX'::text, 'CREDIT_CARD'::text, 'DEBIT_CARD'::text, 'BOLETO'::text]));
    `);

    console.log("Constraint atualizada com sucesso!");
  } catch (err) {
    console.error("Erro ao atualizar constraint:", err);
  } finally {
    await client.end();
  }
}

run();
