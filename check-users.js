import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query("SELECT email, senha_provisoria, funcao, nome, status FROM public.usuarios;");
    console.log("=== OPERADORES CADASTRADOS NO BANCO ===");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
