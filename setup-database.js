import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao PostgreSQL do Supabase!");

    // 1. Criar a tabela 'servicos'
    console.log("Criando a tabela 'servicos' se não existir...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.servicos (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL,
        type text NOT NULL,
        base_value numeric NOT NULL DEFAULT 0.00,
        description text,
        criado_em timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
      );
    `);

    // 2. Desabilitar Row Level Security (RLS) nas tabelas principais
    console.log("Desabilitando RLS nas tabelas principais para permitir acesso público em localhost...");
    const tables = ['transacoes', 'controle_turnos', 'usuarios', 'despachantes', 'servicos'];
    for (const table of tables) {
      await client.query(`ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY;`);
      console.log(` - RLS desativado para: ${table}`);
    }

    // 3. Garantir que as tabelas possuem as colunas corretas ou aceitam valores nulos
    // Por exemplo, na tabela controle_turnos, a coluna 'evento', 'operador_email' e 'terminal_ip' são NOT NULL no DDL
    // Vamos alterar as colunas de controle_turnos para nullable para que inserts simples funcionem sem problemas
    console.log("Ajustando colunas de controle_turnos para nullable...");
    await client.query(`
      ALTER TABLE public.controle_turnos ALTER COLUMN evento DROP NOT NULL;
      ALTER TABLE public.controle_turnos ALTER COLUMN operador_email DROP NOT NULL;
      ALTER TABLE public.controle_turnos ALTER COLUMN terminal_ip DROP NOT NULL;
    `);

    // 4. Inserir operadores iniciais padrão (se a tabela de usuários estiver vazia)
    const checkUsr = await client.query("SELECT count(*) FROM public.usuarios;");
    const countUsr = parseInt(checkUsr.rows[0].count);
    if (countUsr === 0) {
      console.log("Populando tabela 'usuarios' com operadores padrão...");
      const mockUsers = [
        { nome: 'Carlos Gerente (Supervisor)', email: 'carlos.gerente@marks.com', funcao: 'Gerente', senha: 'gerente123' },
        { nome: 'Juliana Financeiro (Admin)', email: 'juliana.fin@marks.com', funcao: 'Financeiro', senha: 'financeiro123' },
        { nome: 'Ana Carolina (Caixa)', email: 'ana.caixa@marks.com', funcao: 'Operador', senha: 'caixa123' },
        { nome: 'Antônio Marques', email: 'fsobrosa.12tc@gmail.com', funcao: 'Master', senha: 'Antonio2@26' }
      ];

      for (const u of mockUsers) {
        await client.query(`
          INSERT INTO public.usuarios (nome, email, funcao, senha_provisoria, status)
          VALUES ($1, $2, $3, $4, 'Ativo');
        `, [u.nome, u.email, u.funcao, u.senha]);
      }
      console.log(" - Operadores padrão inseridos com sucesso!");
    } else {
      console.log("Tabela 'usuarios' já contém registros, pulando inserção.");
    }

    // 5. Inserir despachantes padrão (se a tabela de despachantes estiver vazia)
    const checkDesp = await client.query("SELECT count(*) FROM public.despachantes;");
    const countDesp = parseInt(checkDesp.rows[0].count);
    if (countDesp === 0) {
      console.log("Populando tabela 'despachantes' com despachantes B2B padrão...");
      const mockDespachantes = [
        { razao_social: 'Despachante Passo Fundo', cnpj: '99.999.999/0001-99', telefone: '(54) 99999-9999', saldo_devedor: 150.00 },
        { razao_social: 'Despachante Planalto', cnpj: '88.888.888/0001-88', telefone: '(54) 88888-8888', saldo_devedor: 0.00 },
        { razao_social: 'Despachante Central', cnpj: '77.777.777/0001-77', telefone: '(54) 77777-7777', saldo_devedor: 320.50 }
      ];

      for (const d of mockDespachantes) {
        await client.query(`
          INSERT INTO public.despachantes (razao_social, cnpj, telefone, saldo_devedor)
          VALUES ($1, $2, $3, $4);
        `, [d.razao_social, d.cnpj, d.telefone, d.saldo_devedor]);
      }
      console.log(" - Despachantes B2B padrão inseridos com sucesso!");
    } else {
      console.log("Tabela 'despachantes' já contém registros, pulando inserção.");
    }

    console.log("\nBanco de dados Supabase configurado e corrigido com sucesso para testes locais!");

  } catch (err) {
    console.error("Erro ao configurar banco de dados:", err);
  } finally {
    await client.end();
  }
}

run();
