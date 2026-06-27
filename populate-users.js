import pg from 'pg';

const connectionString = "postgresql://postgres:iSkxlx7C96smJ2bu@db.hyphsoqjyrqpbplwcotk.supabase.co:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado ao Postgres do Supabase para atualizar usuários e constraints.");

    // Alterar o tipo da coluna senha_provisoria para text
    console.log("Ajustando coluna senha_provisoria para text...");
    await client.query("ALTER TABLE public.usuarios ALTER COLUMN senha_provisoria TYPE text;");

    // Drop da constraint antiga de função
    console.log("Ajustando check constraint usuarios_funcao_check...");
    await client.query("ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_funcao_check;");
    
    // Adicionar nova constraint com as roles capitalizadas usadas no frontend
    await client.query(`
      ALTER TABLE public.usuarios 
      ADD CONSTRAINT usuarios_funcao_check 
      CHECK (funcao = ANY (ARRAY['Master'::text, 'Gerente'::text, 'Financeiro'::text, 'Operador'::text]));
    `);

    // Deletar todos os registros de usuarios existentes para garantir consistência
    console.log("Limpando tabela usuarios...");
    await client.query("DELETE FROM public.usuarios;");

    const mockUsers = [
      { nome: 'Carlos Gerente (Supervisor)', email: 'carlos.gerente@marks.com', funcao: 'Gerente', senha: 'gerente123' },
      { nome: 'Juliana Financeiro (Admin)', email: 'juliana.fin@marks.com', funcao: 'Financeiro', senha: 'financeiro123' },
      { nome: 'Ana Carolina (Caixa)', email: 'ana.caixa@marks.com', funcao: 'Operador', senha: 'caixa123' },
      { nome: 'Antônio Marques', email: 'fsobrosa.12tc@gmail.com', funcao: 'Master', senha: 'Antonio2@26' }
    ];

    console.log("Populando operadores com a grafia correta...");
    for (const u of mockUsers) {
      await client.query(`
        INSERT INTO public.usuarios (nome, email, funcao, senha_provisoria, status)
        VALUES ($1, $2, $3, $4, 'Ativo');
      `, [u.nome, u.email, u.funcao, u.senha]);
    }
    console.log("Todos os operadores padrão foram inseridos com sucesso!");

  } catch (err) {
    console.error("Erro ao popular usuários:", err);
  } finally {
    await client.end();
  }
}

run();
