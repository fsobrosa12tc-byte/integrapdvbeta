import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const tables = ['sangrias', 'suprimentos', 'precificacao', 'servicos', 'controle_turnos', 'transacoes', 'usuarios', 'despachantes'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Tabela ${table}: NÃO EXISTE ou erro:`, error.message);
    } else {
      console.log(`Tabela ${table}: EXISTE`);
    }
  }
}

test();
