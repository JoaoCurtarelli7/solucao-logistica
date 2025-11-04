const http = require('http');

function testRegister() {
  const data = JSON.stringify({
    name: 'Teste User',
    email: `test_${Date.now()}@test.com`,
    password: '123456'
  });

  const options = {
    hostname: 'localhost',
    port: 3333,
    path: '/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('🧪 Testando rota /register via HTTP...\n');
  console.log('📤 Dados enviados:', data);
  console.log('');

  const req = http.request(options, (res) => {
    console.log(`📊 Status Code: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    console.log('');

    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('📥 Resposta do servidor:');
      try {
        const parsed = JSON.parse(responseData);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log(responseData);
      }

      if (res.statusCode === 201) {
        console.log('\n✅ Usuário criado com sucesso!');
      } else {
        console.log(`\n❌ Erro ${res.statusCode}`);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Erro na requisição:', error.message);
    console.error('\n💡 Verifique se:');
    console.error('   1. O servidor está rodando (npm run dev)');
    console.error('   2. A porta 3333 está correta');
    console.error('   3. Não há firewall bloqueando');
  });

  req.write(data);
  req.end();
}

testRegister();
