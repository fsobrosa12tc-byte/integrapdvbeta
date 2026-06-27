import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao Postgres do Supabase para limpar dados de testes.");

    // Deletar transação de teste
    await client.query("DELETE FROM public.transacoes WHERE id = '550e8400-e29b-41d4-a716-446655440000';");
    console.log(" - Registro de teste em 'transacoes' removido.");

    // Deletar controle de turno de teste
    await client.query("DELETE FROM public.controle_turnos WHERE terminal_id = 'PF-TEST-CAIXA';");
    console.log(" - Registro de teste em 'controle_turnos' removido.");

    console.log("Banco de dados limpo com sucesso!");
  } catch (err) {
    console.error("Erro ao limpar dados:", err);
  } finally {
    await client.end();
  }
}

run();
