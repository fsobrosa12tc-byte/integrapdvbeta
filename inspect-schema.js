import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
  const url = `${supabaseUrl}/rest/v1/`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    const schema = await res.json();
    
    console.log("=== TABELAS ENCONTRADAS ===");
    const paths = Object.keys(schema.paths || {});
    console.log(paths);

    console.log("\n=== DETALHES DAS TABELAS (DEFINITIONS) ===");
    const definitions = schema.definitions || {};
    for (const tableName of Object.keys(definitions)) {
      console.log(`\nTabela: ${tableName}`);
      const properties = definitions[tableName].properties || {};
      const required = definitions[tableName].required || [];
      console.log("Colunas:", Object.keys(properties).map(col => {
        const prop = properties[col];
        return `${col} (${prop.type}${required.includes(col) ? ' - REQUIRED' : ''})`;
      }));
    }
  } catch (err) {
    console.error("Erro ao inspecionar schema:", err);
  }
}

run();
