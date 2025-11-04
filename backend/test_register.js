const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testRegister() {
  try {
    console.log('🧪 Testando criação de usuário...\n');

    // Teste 1: Verificar conexão
    console.log('1️⃣ Testando conexão...');
    await prisma.$connect();
    console.log('   ✅ Conectado!\n');

    // Teste 2: Verificar estrutura da tabela User
    console.log('2️⃣ Verificando estrutura da tabela User...');
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'User'
      ORDER BY ordinal_position;
    `;
    console.log('   ✅ Colunas encontradas:');
    columns.forEach((col) => {
      console.log(`      - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    console.log('');

    // Teste 3: Tentar criar usuário com Prisma
    console.log('3️⃣ Tentando criar usuário com Prisma...');
    const testEmail = `test_${Date.now()}@test.com`;
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    try {
      const newUser = await prisma.user.create({
        data: {
          name: 'Teste User',
          email: testEmail,
          password: hashedPassword
        }
      });
      console.log('   ✅ Usuário criado com sucesso!');
      console.log('      ID:', newUser.id);
      console.log('      Email:', newUser.email);
      console.log('      Name:', newUser.name);
      console.log('      CreatedAt:', newUser.createdAt);
      console.log('');

      // Limpar usuário de teste
      await prisma.user.delete({ where: { id: newUser.id } });
      console.log('   ✅ Usuário de teste removido\n');
    } catch (createError) {
      console.error('   ❌ Erro ao criar usuário:', createError.message);
      console.error('      Código:', createError.code);
      console.error('      Meta:', createError.meta);
      console.error('      Stack:', createError.stack);
      console.log('');
    }

    // Teste 4: Verificar campos do Prisma Client
    console.log('4️⃣ Verificando modelo User no Prisma Client...');
    try {
      // Tentar buscar um usuário (mesmo que não exista)
      await prisma.user.findFirst();
      console.log('   ✅ Modelo User acessível\n');
    } catch (modelError) {
      console.error('   ❌ Erro ao acessar modelo User:', modelError.message);
      console.log('');
    }

    console.log('✅ Testes concluídos!\n');

  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testRegister();
