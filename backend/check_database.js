const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Verificando conexão e estrutura do banco de dados...\n');

  try {
    // 1. Testar conexão
    console.log('1️⃣ Testando conexão com PostgreSQL...');
    await prisma.$connect();
    console.log('   ✅ Conectado com sucesso!\n');

    // 2. Testar query simples
    console.log('2️⃣ Testando query simples...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('   ✅ Query executada:', result, '\n');

    // 3. Verificar tabelas existentes
    console.log('3️⃣ Verificando tabelas no banco...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    console.log('   ✅ Tabelas encontradas:', tables.length);
    tables.forEach((t) => console.log('      -', t.table_name));
    console.log('');

    // 4. Verificar estrutura da tabela Employee
    console.log('4️⃣ Verificando estrutura da tabela Employee...');
    try {
      const employeeColumns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Employee'
        ORDER BY ordinal_position;
      `;
      console.log('   ✅ Colunas da tabela Employee:');
      employeeColumns.forEach((col) => {
        console.log(`      - ${col.column_name} (${col.data_type})`);
      });
      console.log('');

      // Testar query na tabela Employee
      const employeeCount = await prisma.employee.count();
      console.log(`   ✅ Total de funcionários: ${employeeCount}\n`);
    } catch (error) {
      console.log('   ❌ Erro ao verificar tabela Employee:', error.message);
      console.log('   💡 Execute: npx prisma migrate dev\n');
    }

    // 5. Verificar estrutura da tabela Company
    console.log('5️⃣ Verificando estrutura da tabela Company...');
    try {
      const companyColumns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Company'
        ORDER BY ordinal_position;
      `;
      console.log('   ✅ Colunas da tabela Company:');
      companyColumns.forEach((col) => {
        console.log(`      - ${col.column_name} (${col.data_type})`);
      });
      console.log('');

      const companyCount = await prisma.company.count();
      console.log(`   ✅ Total de empresas: ${companyCount}\n`);
    } catch (error) {
      console.log('   ❌ Erro ao verificar tabela Company:', error.message);
      console.log('   💡 Execute: npx prisma migrate dev\n');
    }

    console.log('✅ Verificação concluída!\n');
    console.log('💡 Se houver erros acima, execute:');
    console.log('   1. npx prisma generate');
    console.log('   2. npx prisma migrate dev');
    console.log('   3. npx prisma db push (opcional, para forçar sincronização)\n');

  } catch (error) {
    console.error('\n❌ Erro na verificação:', error.message);
    console.error('\n🔍 Possíveis problemas:');
    console.error('   1. PostgreSQL não está rodando');
    console.error('   2. DATABASE_URL incorreta no arquivo .env');
    console.error('   3. Banco de dados não existe');
    console.error('   4. Credenciais incorretas');
    console.error('\n💡 Soluções:');
    console.error('   1. Verifique se o PostgreSQL está rodando');
    console.error('   2. Verifique o arquivo .env');
    console.error('   3. Crie o banco: CREATE DATABASE logistica;');
    console.error('   4. Execute: npx prisma migrate dev');
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
