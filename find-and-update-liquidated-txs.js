import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao Supabase PostgreSQL!");

    // 1. Buscar transações
    console.log("Buscando transações com IDs específicos...");
    const res = await client.query(`
      SELECT id, cliente_nome, valor_liquido, forma_pagamento, status_conciliacao 
      FROM public.transacoes 
      WHERE id::text LIKE '075c%' OR id::text LIKE '4a13%' OR id::text LIKE 'f867%'
    `);

    console.log("Transações encontradas:", res.rows);

    if (res.rows.length > 0) {
      const ids = res.rows.map(r => r.id);
      
      // 2. Atualizar transacoes para PAID
      console.log("Atualizando status_conciliacao para 'PAID' na tabela transacoes...");
      await client.query(`
        UPDATE public.transacoes 
        SET status_conciliacao = 'PAID' 
        WHERE id = ANY($1::uuid[])
      `, [ids]);
      console.log("Transações atualizadas para PAID!");

      // 3. Inserir ou atualizar na faturamento_guias com status 'PAGO'
      console.log("Inserindo/Atualizando guias na faturamento_guias com status 'PAGO'...");
      for (const row of res.rows) {
        // Encontra o despachante pelo nome ou cnpj contido no cliente_nome
        const rawClientName = row.cliente_nome || '';
        const cpfCnpjMatch = rawClientName.match(/\((?:CPF|CNPJ):\s*([^\)]+)\)/i);
        const clientCpfCnpj = cpfCnpjMatch ? cpfCnpjMatch[1].trim() : '';

        // Busca o despachante
        const despRes = await client.query(`
          SELECT id FROM public.despachantes 
          WHERE cnpj = $1 OR razao_social = $2
        `, [clientCpfCnpj, rawClientName.replace(/\s*\((?:CPF|CNPJ):[^\)]+\)/i, '').trim()]);

        if (despRes.rows.length > 0) {
          const despachanteId = despRes.rows[0].id;
          
          // Insere a guia como PAGO
          await client.query(`
            INSERT INTO public.faturamento_guias (id, despachante_id, valor_total, status, data_pagamento)
            VALUES ($1, $2, $3, 'PAGO', now())
            ON CONFLICT (id) DO UPDATE 
            SET status = 'PAGO', data_pagamento = now();
          `, [row.id, despachanteId, row.valor_liquido]);
          console.log(`Guia para transação ${row.id} inserida/atualizada como PAGO.`);
        } else {
          console.warn(`Despachante não encontrado para transação: ${row.cliente_nome}`);
        }
      }
    } else {
      console.log("Nenhuma transação encontrada com esses prefixos de ID.");
    }

  } catch (err) {
    console.error("Erro na execução:", err);
  } finally {
    await client.end();
  }
}

run();
