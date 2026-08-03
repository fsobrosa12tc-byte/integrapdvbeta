import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao Supabase PostgreSQL!");

    // 1. Atualizar a transação feed5248-b696-4618-93b5-231fceae1c5e para ser do Despachante Central (R$ 100,67) e status PENDENTE
    console.log("Ajustando transação de R$ 100,67 para Despachante Central...");
    await client.query(`
      UPDATE public.transacoes
      SET status = 'PENDENTE',
          status_conciliacao = 'PENDING',
          cliente_nome = 'Despachante Central (CNPJ: 77.777.777/0001-77)',
          despachante_id = '75e69de8-8d97-4696-9914-0578cda1abc4',
          is_convenio = true,
          tipo = 'GUIA'
      WHERE id = 'feed5248-b696-4618-93b5-231fceae1c5e'
    `);

    // 2. Garantir que as outras duas guias de Dino (139.23) e Passo Fundo (252.14) estão como PENDENTE
    await client.query(`
      UPDATE public.transacoes
      SET status = 'PENDENTE',
          status_conciliacao = 'PENDING'
      WHERE id IN ('ffd96e9f-11e0-4e03-9140-f86bfcb90f3e', '1d47f34a-40b3-4ed4-8e18-144f0659df47')
    `);

    // 3. Cancelar qualquer outra transação que esteja PENDENTE e não seja uma destas três
    await client.query(`
      UPDATE public.transacoes
      SET status = 'CANCELADO',
          status_conciliacao = 'CANCELLED'
      WHERE (status = 'PENDENTE' OR status_conciliacao = 'PENDING')
        AND id NOT IN ('feed5248-b696-4618-93b5-231fceae1c5e', 'ffd96e9f-11e0-4e03-9140-f86bfcb90f3e', '1d47f34a-40b3-4ed4-8e18-144f0659df47')
    `);

    // 4. Inserir ou atualizar na tabela faturamento_guias a guia do Despachante Central
    await client.query(`
      INSERT INTO public.faturamento_guias (id, despachante_id, valor_total, status, criado_em)
      VALUES (
        'feed5248-b696-4618-93b5-231fceae1c5e',
        '75e69de8-8d97-4696-9914-0578cda1abc4',
        100.67,
        'PENDENTE',
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET status = 'PENDENTE', valor_total = 100.67;
    `);

    // 5. Ajustar saldo_devedor na tabela despachantes
    // Despachante Central: R$ 100,67
    await client.query(`
      UPDATE public.despachantes
      SET saldo_devedor = 100.67
      WHERE id = '75e69de8-8d97-4696-9914-0578cda1abc4'
    `);

    // Dino Despachante: R$ 139,23
    await client.query(`
      UPDATE public.despachantes
      SET saldo_devedor = 139.23
      WHERE id = '17ff42bd-c92c-4c75-b571-5946ff3afece'
    `);

    // Despachante Passo Fundo: R$ 252,14
    await client.query(`
      UPDATE public.despachantes
      SET saldo_devedor = 252.14
      WHERE id = 'cb3a224a-e539-4023-807e-b0cf37813b36'
    `);

    // Outros despachantes: 0.00
    await client.query(`
      UPDATE public.despachantes
      SET saldo_devedor = 0.00
      WHERE id NOT IN (
        '75e69de8-8d97-4696-9914-0578cda1abc4',
        '17ff42bd-c92c-4c75-b571-5946ff3afece',
        'cb3a224a-e539-4023-807e-b0cf37813b36'
      )
    `);

    console.log("Banco de dados ajustado com sucesso para totalizar R$ 492,04!");

  } catch (err) {
    console.error("Erro ao rodar script de ajuste 2:", err);
  } finally {
    await client.end();
  }
}

run();
