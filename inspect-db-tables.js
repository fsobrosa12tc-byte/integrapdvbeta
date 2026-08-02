import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado!");

    // Lista todas as tabelas no schema public
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log("Tabelas em 'public':", res.rows.map(r => r.table_name));

    for (const row of res.rows) {
      const tableName = row.table_name;
      console.log(`\n--- Tabela: ${tableName} ---`);

      const columnsRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      columnsRes.rows.forEach(c => {
        console.log(`  ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`);
      });
    }

  } catch (err) {
    console.error("Erro:", err);
  } finally {
    await client.end();
  }
}

run();
