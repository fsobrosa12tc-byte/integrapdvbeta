import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    console.log("=== TURNOS EM CONTROLE_TURNOS ===");
    const { data: turnos, error: turnosErr } = await supabase
      .from('controle_turnos')
      .select('id, status, data_operacional, operador_email, terminal_id, horario_abertura');
    
    if (turnosErr) console.error("Erro turnos:", turnosErr);
    else console.log(turnos);

  } catch (err) {
    console.error('Falha:', err);
  }
}

run();
