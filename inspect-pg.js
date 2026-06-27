import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao PostgreSQL com sucesso!");

    // 1. Listar todas as tabelas do schema public
    console.log("\n=== TABELAS NO SCHEMA PUBLIC ===");
    const resTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(resTables.rows.map(r => r.table_name));

    // 2. Listar colunas de cada tabela
    for (const row of resTables.rows) {
      const tableName = row.table_name;
      console.log(`\n=== COLUNAS DA TABELA: ${tableName} ===`);
      const resColumns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);
      
      resColumns.rows.forEach(c => {
        console.log(` - ${c.column_name} (${c.data_type}) - Nullable: ${c.is_nullable} - Default: ${c.column_default}`);
      });
    }

  } catch (err) {
    console.error("Erro ao conectar ou consultar o Postgres:", err);
  } finally {
    await client.end();
  }
}

run();
