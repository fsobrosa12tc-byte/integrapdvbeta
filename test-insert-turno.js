import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsertTurno() {
  const fakeTurno = {
    terminal_id: 'PF-TEST-CAIXA',
    data_operacional: new Date().toLocaleDateString('pt-BR'),
    horario_abertura: '08:00:00',
    horario_fechamento: '18:00:00',
    usuario_master: 'fsobrosa.12tc@gmail.com',
    fundo_troco: 100.00,
    entradas_dinheiro: 0.00,
    entradas_pix: 0.00,
    entradas_credito: 0.00,
    entradas_debito: 0.00,
    entradas_boleto: 0.00,
    reforcos: 0.00,
    retiradas: 0.00,
    saldo_esperado: 100.00,
    saldo_informado: 100.00,
    divergencia: 0.00,
    status: 'Conciliado',
    particular_qty: 0,
    particular_total: 0.00,
    b2b_qty: 0,
    b2b_total: 0.00,
    timeline: []
  };

  console.log("Tentando inserir turno teste...");
  const { data, error } = await supabase
    .from('controle_turnos')
    .insert([fakeTurno])
    .select();

  if (error) {
    console.error("Erro ao inserir turno:", error.message, error);
  } else {
    console.log("Turno inserido com sucesso! Registro retornado:", data);
  }
}

testInsertTurno();
