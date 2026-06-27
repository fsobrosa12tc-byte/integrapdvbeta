import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao Postgres do Supabase!");

    // 1. Adicionar coluna status_turno se não existir
    console.log("Adicionando coluna status_turno na tabela controle_turnos...");
    await client.query(`
      ALTER TABLE public.controle_turnos 
      ADD COLUMN IF NOT EXISTS status_turno text;
    `);

    // 2. Atualizar status_turno com os valores da coluna status
    console.log("Atualizando status_turno com os valores de status...");
    await client.query(`
      UPDATE public.controle_turnos 
      SET status_turno = status 
      WHERE status_turno IS NULL;
    `);

    console.log("Coluna status_turno adicionada e atualizada com sucesso!");
  } catch (err) {
    console.error("Erro ao alterar tabela:", err);
  } finally {
    await client.end();
  }
}

run();
