import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao Supabase PostgreSQL!");

    // 1. Atualizar transacoes indesejadas com status PENDENTE ou PENDING para CANCELADO
    // Mantendo apenas:
    // - Dino Despachante (139.23, id: ffd96e9f-11e0-4e03-9140-f86bfcb90f3e)
    // - Despachante Passo Fundo (252.14, id: 1d47f34a-40b3-4ed4-8e18-144f0659df47)
    console.log("Cancelando transações pendentes de teste/antigas...");
    const cancelRes = await client.query(`
      UPDATE public.transacoes
      SET status = 'CANCELADO', status_conciliacao = 'CANCELLED'
      WHERE (status = 'PENDENTE' OR status_conciliacao = 'PENDING')
        AND id NOT IN ('ffd96e9f-11e0-4e03-9140-f86bfcb90f3e', '1d47f34a-40b3-4ed4-8e18-144f0659df47')
    `);
    console.log(`Transações canceladas: ${cancelRes.rowCount}`);

    // 2. Garantir que as duas transações válidas estão de fato como PENDENTE na tabela transacoes
    console.log("Garantindo status PENDENTE nas duas transações corretas...");
    const updateCorrectRes = await client.query(`
      UPDATE public.transacoes
      SET status = 'PENDENTE', status_conciliacao = 'PENDING'
      WHERE id IN ('ffd96e9f-11e0-4e03-9140-f86bfcb90f3e', '1d47f34a-40b3-4ed4-8e18-144f0659df47')
    `);
    console.log(`Transações ajustadas para PENDENTE: ${updateCorrectRes.rowCount}`);

    // 3. Garantir que as guias correspondentes estão corretas na tabela faturamento_guias
    // Cancelar as outras guias pendentes em faturamento_guias
    const cancelGuiasRes = await client.query(`
      UPDATE public.faturamento_guias
      SET status = 'CANCELADO'
      WHERE status = 'PENDENTE'
        AND id NOT IN ('ffd96e9f-11e0-4e03-9140-f86bfcb90f3e', '1d47f34a-40b3-4ed4-8e18-144f0659df47')
    `);
    console.log(`Guias canceladas em faturamento_guias: ${cancelGuiasRes.rowCount}`);

    // Inserir ou atualizar Dino Despachante (139.23) na faturamento_guias
    console.log("Inserindo/atualizando guia do Dino Despachante...");
    await client.query(`
      INSERT INTO public.faturamento_guias (id, despachante_id, valor_total, status, criado_em)
      VALUES (
        'ffd96e9f-11e0-4e03-9140-f86bfcb90f3e',
        '17ff42bd-c92c-4c75-b571-5946ff3afece',
        139.23,
        'PENDENTE',
        '2026-08-02T20:46:49.538Z'
      )
      ON CONFLICT (id) DO UPDATE
      SET status = 'PENDENTE', valor_total = 139.23;
    `);

    // Inserir ou atualizar Despachante Passo Fundo (252.14) na faturamento_guias
    console.log("Inserindo/atualizando guia do Despachante Passo Fundo...");
    await client.query(`
      INSERT INTO public.faturamento_guias (id, despachante_id, valor_total, status, criado_em)
      VALUES (
        '1d47f34a-40b3-4ed4-8e18-144f0659df47',
        'cb3a224a-e539-4023-807e-b0cf37813b36',
        252.14,
        'PENDENTE',
        '2026-08-02T18:37:30.777Z'
      )
      ON CONFLICT (id) DO UPDATE
      SET status = 'PENDENTE', valor_total = 252.14;
    `);

    // 4. Atualizar o saldo_devedor na tabela despachantes
    // Dino Despachante: R$ 139,23
    console.log("Atualizando saldo devedor de Dino Despachante...");
    await client.query(`
      UPDATE public.despachantes
      SET saldo_devedor = 139.23
      WHERE id = '17ff42bd-c92c-4c75-b571-5946ff3afece'
    `);

    // Despachante Passo Fundo: R$ 252,14
    console.log("Atualizando saldo devedor de Despachante Passo Fundo...");
    await client.query(`
      UPDATE public.despachantes
      SET saldo_devedor = 252.14
      WHERE id = 'cb3a224a-e539-4023-807e-b0cf37813b36'
    `);

    // Outros despachantes: saldo_devedor = 0 para consistência
    console.log("Resetando saldo devedor de outros despachantes para 0...");
    await client.query(`
      UPDATE public.despachantes
      SET saldo_devedor = 0.00
      WHERE id NOT IN ('17ff42bd-c92c-4c75-b571-5946ff3afece', 'cb3a224a-e539-4023-807e-b0cf37813b36')
    `);

    console.log("Tudo pronto e ajustado com sucesso!");

  } catch (err) {
    console.error("Erro ao rodar script de ajuste:", err);
  } finally {
    await client.end();
  }
}

run();
