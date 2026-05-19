import { app } from "../../app";
import { prisma } from "../../lib/prisma";
import { hashPassword, generateToken } from "../../lib/auth";

export const TEST_PASSWORD = "TestPass@123456";

async function getOrCreateAdminRole() {
  const existing = await prisma.role.findFirst({ where: { name: "Admin" } });
  if (existing) return existing;
  return prisma.role.create({ data: { name: "Admin", description: "Test admin" } });
}

export async function createTestContext() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const tenant = await prisma.tenant.create({
    data: { name: `TestTenant-${suffix}`, status: "active" },
  });

  const adminRole = await getOrCreateAdminRole();
  const allPerms = await prisma.permission.findMany({ select: { key: true } });
  const permissions = allPerms.map((p) => p.key);

  const user = await prisma.user.create({
    data: {
      name: "Test Admin",
      email: `admin-${suffix}@test.local`,
      password: await hashPassword(TEST_PASSWORD),
      tenantId: tenant.id,
      isSuperAdmin: false,
      status: "active",
      roleId: adminRole.id,
    },
  });

  const token = generateToken({
    userId: user.id,
    tenantId: tenant.id,
    isSuperAdmin: false,
    roleId: adminRole.id,
    role: "Admin",
    permissions,
  });

  const authHeaders = { Authorization: `Bearer ${token}` };

  async function cleanup() {
    await prisma.financialEntry.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.closing.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.loadBillingClosing.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.load.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.month.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tripExpense.deleteMany({ where: { Trip: { tenantId: tenant.id } } });
    await prisma.trip.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.maintenance.deleteMany({ where: { Truck: { tenantId: tenant.id } } });
    await prisma.truck.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.employee.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.company.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }

  return { tenant, user, token, authHeaders, cleanup };
}

export async function createTestCompany(tenantId: number) {
  const suffix = Date.now().toString();
  return prisma.company.create({
    data: {
      name: `Empresa Test ${suffix}`,
      type: "Transportadora",
      cnpj: `${suffix.slice(0, 14).padStart(14, "0")}`,
      dateRegistration: new Date("2024-01-01"),
      status: "Ativa",
      responsible: "Responsável Test",
      commission: 5.0,
      tenantId,
    },
  });
}

export async function createTestMonth(tenantId: number) {
  const now = new Date();
  return prisma.month.upsert({
    where: { uq_month_year_month_tenant: { year: now.getFullYear(), month: now.getMonth() + 1, tenantId } },
    create: {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      name: `Mês Test ${now.getFullYear()}-${now.getMonth() + 1}`,
      tenantId,
      status: "aberto",
    },
    update: {},
  });
}

export { app };
