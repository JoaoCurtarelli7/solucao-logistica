const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Iniciando população do banco de dados (schema atual)...')

  try {
    // Empresas
    const company1 = await prisma.company.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Transportadora ABC Ltda',
        type: 'Transportadora',
        cnpj: '12.345.678/0001-90',
        dateRegistration: new Date('2020-01-15'),
        status: 'Ativo',
        responsible: 'João Silva',
        commission: 5.5
      }
    })

    // Usuário admin básico (senha: admin123)
    const adminPassword = await bcrypt.hash('admin123', 10)
    await prisma.user.upsert({
      where: { id: 1 },
      update: { password: adminPassword },
      create: {
        name: 'Admin',
        email: 'admin@example.com',
        password: adminPassword,
        phone: '(11) 99999-0000',
        address: 'São Paulo/SP'
      }
    })

    // Caminhões
    const truck1 = await prisma.truck.upsert({
      where: { plate: 'ABC-1A23' },
      update: {},
      create: {
        name: 'Caminhão 1',
        plate: 'ABC-1A23',
        brand: 'Volvo',
        year: 2020,
        docExpiry: new Date('2026-01-01'),
        renavam: '12345678901',
        image: null
      }
    })

    const truck2 = await prisma.truck.upsert({
      where: { plate: 'XYZ-4B56' },
      update: {},
      create: {
        name: 'Caminhão 2',
        plate: 'XYZ-4B56',
        brand: 'Scania',
        year: 2019,
        docExpiry: new Date('2025-06-01'),
        renavam: '10987654321',
        image: null
      }
    })

    // Manutenções
    await prisma.maintenance.create({
      data: {
        date: new Date('2024-01-10'),
        service: 'Troca de óleo e filtros',
        km: 120000,
        value: 450.0,
        notes: 'Usar óleo sintético',
        truckId: truck1.id
      }
    })
    await prisma.maintenance.create({
      data: {
        date: new Date('2024-02-15'),
        service: 'Revisão de freios',
        km: 122500,
        value: 1200.0,
        notes: null,
        truckId: truck2.id
      }
    })

    // Viagens
    const trip1 = await prisma.trip.create({
      data: {
        destination: 'Rio de Janeiro/RJ',
        driver: 'Carlos Silva',
        date: new Date('2024-03-10'),
        freightValue: 3200.0,
        status: 'concluida',
        notes: 'Viagem tranquila',
        truckId: truck1.id
      }
    })

    const trip2 = await prisma.trip.create({
      data: {
        destination: 'Belo Horizonte/MG',
        driver: 'Roberto Santos',
        date: new Date('2024-03-15'),
        freightValue: 2800.0,
        status: 'em_andamento',
        notes: null,
        truckId: truck2.id
      }
    })

    // Entradas/Saídas/Impostos (FinancialEntry)
    await prisma.financialEntry.create({
      data: {
        description: 'Recebimento Frete RJ',
        amount: 3200.0,
        category: 'Fretes',
        date: new Date('2024-03-12'),
        type: 'entrada',
        observations: 'Cliente ABC',
        companyId: company1.id
      }
    })
    await prisma.financialEntry.create({
      data: {
        description: 'Combustível - Caminhão 1',
        amount: 600.0,
        category: 'Operacional',
        date: new Date('2024-03-12'),
        type: 'saida',
        observations: 'Posto Shell',
        companyId: company1.id
      }
    })
    await prisma.financialEntry.create({
      data: {
        description: 'ISS - Março',
        amount: 150.0,
        category: 'Tributos',
        date: new Date('2024-03-15'),
        type: 'imposto',
        observations: null,
        companyId: company1.id
      }
    })

    // Despesas das viagens
    await prisma.tripExpense.create({
      data: {
        description: 'Combustível',
        amount: 500.0,
        date: new Date('2024-03-10'),
        category: 'Combustível',
        notes: 'Posto BR',
        tripId: trip1.id
      }
    })
    await prisma.tripExpense.create({
      data: {
        description: 'Pedágio',
        amount: 120.0,
        date: new Date('2024-03-10'),
        category: 'Pedágio',
        notes: null,
        tripId: trip1.id
      }
    })

    console.log('✅ Banco de dados populado com sucesso!')
  } catch (error) {
    console.error('❌ Erro ao popular banco de dados:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
