import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const fakeTx = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    operador_email: 'fsobrosa.12tc@gmail.com',
    terminal_ip: '127.0.0.1',
    cliente_nome: 'Particular (Consumidor) (CPF: 000.000.000-00)',
    forma_pagamento: 'CASH',
    valor_bruto: 98.00,
    valor_liquido: 100.00,
    issqn: 2.00,
    hash_auditoria: 'TEST-HASH-123',
    itens: [
      {
        serviceName: 'Vistoria Especial',
        type: 'OPERACIONAL',
        value: '98.00',
        quantity: 1,
        subtotal: '98.00'
      }
    ],
    status_conciliacao: 'PAID'
  };

  console.log("Tentando inserir transação teste...");
  const { data, error } = await supabase
    .from('transacoes')
    .insert([fakeTx])
    .select();

  if (error) {
    console.error("Erro ao inserir transação:", error.message, error);
  } else {
    console.log("Transação inserida com sucesso! Registro retornado:", data);
  }
}

testInsert();
