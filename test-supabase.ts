import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('Chave carregada:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados no .env!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // 1. Testa transações
    const { data: txData, error: txError, count: txCount } = await supabase
      .from('transacoes')
      .select('*', { count: 'exact', head: true });

    if (txError) {
      console.error('Erro ao ler transacoes:', txError);
    } else {
      console.log('Tabela transacoes: Conexão OK. Total de registros:', txCount);
    }

    // 2. Testa despachantes
    const { data: despData, error: despError, count: despCount } = await supabase
      .from('despachantes')
      .select('*', { count: 'exact', head: true });

    if (despError) {
      console.error('Erro ao ler despachantes:', despError);
    } else {
      console.log('Tabela despachantes: Conexão OK. Total de registros:', despCount);
    }

    // 3. Testa controle_turnos
    const { data: turnosData, error: turnosError, count: turnosCount } = await supabase
      .from('controle_turnos')
      .select('*', { count: 'exact', head: true });

    if (turnosError) {
      console.error('Erro ao ler controle_turnos:', turnosError);
    } else {
      console.log('Tabela controle_turnos: Conexão OK. Total de registros:', turnosCount);
    }

  } catch (err) {
    console.error('Erro inesperado na conexão:', err);
  }
  process.exit(0);
}

testConnection();
