import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado!");

    // Busca tabelas que contêm 'guia' ou 'convenio' no nome em qualquer schema
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%guia%' OR table_name LIKE '%convenio%'
      ORDER BY table_schema, table_name;
    `);

    console.log("Tabelas encontradas:", res.rows);

  } catch (err) {
    console.error("Erro:", err);
  } finally {
    await client.end();
  }
}

run();
