import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
  const tables = ['transacoes', 'controle_turnos', 'usuarios', 'despachantes'];
  for (const table of tables) {
    const url = `${supabaseUrl}/rest/v1/${table}`;
    try {
      const res = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      // A resposta do OPTIONS vem no header ou no body como JSON
      const data = await res.json();
      console.log(`=== COLUNAS PARA ${table} ===`);
      if (data && data.definitions && data.definitions[table]) {
        const props = data.definitions[table].properties || {};
        console.log(Object.keys(props));
      } else {
        console.log("Sem definição retornada no body");
      }
    } catch (err) {
      console.error(`Erro ao obter OPTIONS para ${table}:`, err);
    }
  }
}

run();
