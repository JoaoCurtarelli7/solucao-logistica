const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Iniciando população do banco de dados (schema atual)...");

  try {
    // RBAC - permissões base do sistema
    const basePermissions = [
      // Dashboard
      "dashboard.view",

      // Usuários e Permissões
      "users.view",
      "users.create",
      "users.update",
      "users.delete",
      "users.manage",

      // Empresas
      "companies.view",
      "companies.create",
      "companies.update",
      "companies.delete",

      // Funcionários
      "employees.view",
      "employees.create",
      "employees.update",
      "employees.delete",

      // Caminhões
      "trucks.view",
      "trucks.create",
      "trucks.update",
      "trucks.delete",

      // Viagens
      "trips.view",
      "trips.create",
      "trips.update",
      "trips.delete",

      // Despesas de Viagem
      "tripExpenses.view",
      "tripExpenses.create",
      "tripExpenses.update",
      "tripExpenses.delete",

      // Manutenções
      "maintenance.view",
      "maintenance.create",
      "maintenance.update",
      "maintenance.delete",

      // Cargas
      "loads.view",
      "loads.create",
      "loads.update",
      "loads.delete",

      // Financeiro
      "financial.view",
      "financial.create",
      "financial.update",
      "financial.delete",

      // Fechamentos
      "closings.view",
      "closings.create",
      "closings.update",
      "closings.delete",

      // Meses
      "months.view",
      "months.create",
      "months.update",
      "months.delete",

      // Relatórios
      "reports.view",
      "reports.export",

      // Perfis e Permissões
      "roles.view",
      "roles.create",
      "roles.update",
      "roles.delete",
      "permissions.view",
      "permissions.create",
      "permissions.update",
      "permissions.delete",
    ];

    await prisma.permission.createMany({
      data: basePermissions.map((key) => ({ key })),
      skipDuplicates: true,
    });

    const adminRole = await prisma.role.upsert({
      where: { name: "Admin" },
      update: {},
      create: { name: "Admin", description: "Acesso total ao sistema" },
    });

    // Criar role padrão "User" para novos usuários
    const userRole = await prisma.role.upsert({
      where: { name: "User" },
      update: {},
      create: { name: "User", description: "Usuário padrão do sistema" },
    });

    const perms = await prisma.permission.findMany({
      where: { key: { in: basePermissions } },
      select: { id: true },
    });

    // Atribuir todas as permissões ao Admin
    await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    // Atribuir permissões básicas ao User (apenas visualização)
    const userPermissions = [
      "dashboard.view",
      "companies.view",
      "employees.view",
      "trucks.view",
      "trips.view",
      "tripExpenses.view",
      "maintenance.view",
      "loads.view",
      "financial.view",
      "closings.view",
      "months.view",
      "reports.view",
    ];

    const userPerms = await prisma.permission.findMany({
      where: { key: { in: userPermissions } },
      select: { id: true },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: userRole.id } });
    if (userPerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: userPerms.map((p) => ({
          roleId: userRole.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }

    // Empresas
    const company1 = await prisma.company.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: "Transportadora ABC Ltda",
        type: "Transportadora",
        cnpj: "12.345.678/0001-90",
        dateRegistration: new Date("2020-01-15"),
        status: "Ativo",
        responsible: "João Silva",
        commission: 5.5,
      },
    });

    // Atualizar usuários existentes sem role para ter o role "User"
    await prisma.user.updateMany({
      where: { roleId: null },
      data: { roleId: userRole.id },
    });

    // Usuário admin básico (senha: admin123)
    const adminPassword = await bcrypt.hash("admin123", 10);
    await prisma.user.upsert({
      where: { id: 1 },
      update: {
        roleId: adminRole.id, // Garantir que o admin tenha o role Admin
      },
      create: {
        name: "Admin",
        email: "admin@example.com",
        password:
          "$2a$10$dfcE5w0bD5hMmcD1xQmI4uG1tq9H2Yy0bZlq0N1bXn7m6o1n2uG2u", // bcrypt de "admin123"
        phone: "(11) 99999-0000",
        address: "São Paulo/SP",
        status: "active",
        roleId: adminRole.id,
      },
    });

    // Caminhões
    const truck1 = await prisma.truck.upsert({
      where: { plate: "ABC-1A23" },
      update: {},
      create: {
        name: "Caminhão 1",
        plate: "ABC-1A23",
        brand: "Volvo",
        year: 2020,
        docExpiry: new Date("2026-01-01"),
        renavam: "12345678901",
        image: null,
      },
    });

    const truck2 = await prisma.truck.upsert({
      where: { plate: "XYZ-4B56" },
      update: {},
      create: {
        name: "Caminhão 2",
        plate: "XYZ-4B56",
        brand: "Scania",
        year: 2019,
        docExpiry: new Date("2025-06-01"),
        renavam: "10987654321",
        image: null,
      },
    });

    // Manutenções
    await prisma.maintenance.create({
      data: {
        date: new Date("2024-01-10"),
        service: "Troca de óleo e filtros",
        km: 120000,
        value: 450.0,
        notes: "Usar óleo sintético",
        truckId: truck1.id,
      },
    });
    await prisma.maintenance.create({
      data: {
        date: new Date("2024-02-15"),
        service: "Revisão de freios",
        km: 122500,
        value: 1200.0,
        notes: null,
        truckId: truck2.id,
      },
    });

    // Viagens
    const trip1 = await prisma.trip.create({
      data: {
        destination: "Rio de Janeiro/RJ",
        driver: "Carlos Silva",
        date: new Date("2024-03-10"),
        freightValue: 3200.0,
        status: "concluida",
        notes: "Viagem tranquila",
        truckId: truck1.id,
      },
    });

    const trip2 = await prisma.trip.create({
      data: {
        destination: "Belo Horizonte/MG",
        driver: "Roberto Santos",
        date: new Date("2024-03-15"),
        freightValue: 2800.0,
        status: "em_andamento",
        notes: null,
        truckId: truck2.id,
      },
    });

    // Entradas/Saídas/Impostos (FinancialEntry)
    await prisma.financialEntry.create({
      data: {
        description: "Recebimento Frete RJ",
        amount: 3200.0,
        category: "Fretes",
        date: new Date("2024-03-12"),
        type: "entrada",
        observations: "Cliente ABC",
        companyId: company1.id,
      },
    });
    await prisma.financialEntry.create({
      data: {
        description: "Combustível - Caminhão 1",
        amount: 600.0,
        category: "Operacional",
        date: new Date("2024-03-12"),
        type: "saida",
        observations: "Posto Shell",
        companyId: company1.id,
      },
    });
    await prisma.financialEntry.create({
      data: {
        description: "ISS - Março",
        amount: 150.0,
        category: "Tributos",
        date: new Date("2024-03-15"),
        type: "imposto",
        observations: null,
        companyId: company1.id,
      },
    });

    // Despesas das viagens
    await prisma.tripExpense.create({
      data: {
        description: "Combustível",
        amount: 500.0,
        date: new Date("2024-03-10"),
        category: "Combustível",
        notes: "Posto BR",
        tripId: trip1.id,
      },
    });
    await prisma.tripExpense.create({
      data: {
        description: "Pedágio",
        amount: 120.0,
        date: new Date("2024-03-10"),
        category: "Pedágio",
        notes: null,
        tripId: trip1.id,
      },
    });

    // Catálogo padrão de serviços de manutenção (frota)
    const defaultMaintenanceServices = [
      "Troca de óleo do motor",
      "Troca de óleo da caixa",
      "Troca de óleo do diferencial",
      "Troca de filtros (ar, óleo, combustível)",
      "Revisão geral / preventiva",
      "Freios (pastilhas / lonas / discos)",
      "Pneus (troca / alinhamento / balanceamento)",
      "Suspensão e direção",
      "Elétrica e bateria",
      "Arrefecimento (radiador / bomba d'água)",
      "Embreagem",
      "Injeção eletrônica / diagnóstico",
    ];
    for (const name of defaultMaintenanceServices) {
      await prisma.maintenanceServicePreset.upsert({
        where: { name },
        create: { name, isDefault: true },
        update: {},
      });
    }

    console.log("✅ Banco de dados populado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao popular banco de dados:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
