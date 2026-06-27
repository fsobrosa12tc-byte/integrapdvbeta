import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conname = 'usuarios_funcao_check';
    `);
    console.log("=== DEFINIÇÃO DA CONSTRAINT ===");
    console.log(res.rows[0]?.constraint_definition);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
