import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao Postgres!");

    // 1. Turnos ativos
    console.log("\n=== TURNOS ATIVOS EM CONTROLE_TURNOS ===");
    const resTurnos = await client.query(`
      SELECT id, status, data_operacional, operador_email, terminal_id, horario_abertura 
      FROM controle_turnos 
      ORDER BY data_operacional DESC;
    `);
    console.log(resTurnos.rows);

    // 2. Transações de hoje
    console.log("\n=== ULTIMAS TRANSACOES GRAVADAS ===");
    const resTxs = await client.query(`
      SELECT id, criado_em, operador_email, data_operacional, terminal_id, valor_liquido, valor_bruto, status_conciliacao
      FROM transacoes 
      ORDER BY criado_em DESC 
      LIMIT 10;
    `);
    console.log(resTxs.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
