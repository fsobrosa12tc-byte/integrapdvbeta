import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao PostgreSQL!");

    // Atualizar todos os turnos com status Aberto para Conciliado ou Fechado
    console.log("Fechando todos os turnos que estavam com status Aberto...");
    const res = await client.query(`
      UPDATE public.controle_turnos 
      SET status = 'Conciliado', status_turno = 'Fechado' 
      WHERE status = 'Aberto' OR status_turno = 'Aberto';
    `);

    console.log(`Sucesso! ${res.rowCount} turnos antigos foram fechados.`);
  } catch (err) {
    console.error("Erro ao fechar turnos:", err);
  } finally {
    await client.end();
  }
}

run();
