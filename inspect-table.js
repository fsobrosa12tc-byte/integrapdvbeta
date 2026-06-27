import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    console.log("=== COLUNAS TRANSACOES ===");
    const { data: txData, error: txErr } = await supabase
      .from('transacoes')
      .select('*')
      .limit(1);
    if (txErr) console.error("Erro transacoes:", txErr);
    else if (txData && txData.length > 0) console.log(Object.keys(txData[0]));
    else console.log("Nenhum registro em transacoes");

    console.log("=== COLUNAS DESPACHANTES ===");
    const { data: despData, error: despErr } = await supabase
      .from('despachantes')
      .select('*')
      .limit(1);
    if (despErr) console.error("Erro despachantes:", despErr);
    else if (despData && despData.length > 0) console.log(Object.keys(despData[0]));
    else console.log("Nenhum registro em despachantes");

    console.log("=== COLUNAS CONTROLE_TURNOS ===");
    const { data: turnosData, error: turnosErr } = await supabase
      .from('controle_turnos')
      .select('*')
      .limit(1);
    if (turnosErr) console.error("Erro controle_turnos:", turnosErr);
    else if (turnosData && turnosData.length > 0) console.log(Object.keys(turnosData[0]));
    else console.log("Nenhum registro em controle_turnos");

    console.log("=== COLUNAS USUARIOS ===");
    const { data: usrData, error: usrErr } = await supabase
      .from('usuarios')
      .select('*')
      .limit(1);
    if (usrErr) console.error("Erro usuarios:", usrErr);
    else if (usrData && usrData.length > 0) console.log(Object.keys(usrData[0]));
    else console.log("Nenhum registro em usuarios");

    process.exit(0);
  } catch (err) {
    console.error('Falha:', err);
    process.exit(1);
  }
}

run();

