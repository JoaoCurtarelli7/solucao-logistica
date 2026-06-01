import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/permissionMiddleware";

// Helper: calcula total de salários de um mês para um tenant
async function calcMonthSalaries(
  tenantId: number,
  year: number,
  month: number,
): Promise<{ total: number; entries: Array<{ empId: number; name: string; amount: number }> }> {
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const employees = await prisma.employee.findMany({
    where: { status: "Ativo", tenantId },
    include: {
      Transaction: { where: { date: { gte: startOfMonth, lte: endOfMonth } } },
    },
  });

  let total = 0;
  const entries: Array<{ empId: number; name: string; amount: number }> = [];

  for (const emp of employees) {
    const credits = (emp.Transaction ?? [])
      .filter((t) => t.type === "Crédito" || t.type === "Credito")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const debits = (emp.Transaction ?? [])
      .filter((t) => t.type === "Débito" || t.type === "Debito")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const finalSalary = Number(emp.baseSalary || 0) + credits - debits;
    if (finalSalary > 0) {
      total += finalSalary;
      entries.push({ empId: emp.id, name: emp.name, amount: finalSalary });
    }
  }

  return { total, entries };
}

export async function closingRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  const createClosingSchema = z.object({
    monthId: z.number(),
    companyId: z.preprocess(
      (v) => (v === "" || v === undefined || v === "null" ? undefined : Number(v)),
      z.number().nullable().optional()
    ),
    name: z.string().min(1, "Nome do fechamento é obrigatório"),
    startDate: z.string().nullable().optional().transform((str) => {
      if (!str) return null;
      const [day, month, year] = str.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }),
    endDate: z.string().nullable().optional().transform((str) => {
      if (!str) return null;
      const [day, month, year] = str.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }),
  });

  const updateClosingSchema = z.object({
    name: z.string().min(1).optional(),
    startDate: z.string().nullable().transform((str) => {
      if (!str) return null;
      const [day, month, year] = str.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }).optional(),
    endDate: z.string().nullable().transform((str) => {
      if (!str) return null;
      const [day, month, year] = str.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }).optional(),
    status: z.enum(["aberto", "fechado", "cancelado"]).optional(),
  });

  // Listar fechamentos
  app.get("/closings", { preHandler: requirePermission("closings.view") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { monthId, companyId, status } = req.query as {
        monthId?: string;
        companyId?: string;
        status?: string;
      };

      const tenantId = req.user!.tenantId;
      const whereClause: any = { tenantId };

      if (monthId) whereClause.monthId = parseInt(monthId);
      if (companyId) whereClause.companyId = parseInt(companyId);
      if (status) whereClause.status = status;

      const closings = await prisma.closing.findMany({
        where: whereClause,
        include: {
          Month: { select: { id: true, name: true, year: true, month: true } },
          Company: { select: { id: true, name: true, cnpj: true } },
          FinancialEntry: { select: { type: true, amount: true, category: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Calcular salários por mês para incluir nas saídas
      const salaryByMonth = new Map<string, number>();
      const uniqueMonths = new Map<string, { year: number; month: number }>();
      for (const c of closings) {
        const m = (c as any).Month;
        if (m?.year != null && m?.month != null) {
          uniqueMonths.set(`${m.year}-${m.month}`, { year: m.year, month: m.month });
        }
      }
      for (const [key, { year, month }] of uniqueMonths) {
        const { total } = await calcMonthSalaries(tenantId, year, month);
        salaryByMonth.set(key, total);
      }

      const formattedClosings = closings.map((c) => {
        const entries = (c as any).FinancialEntry || [];
        const totalEntries = entries.filter((e: any) => e.type === "entrada").reduce((s: number, e: any) => s + e.amount, 0);
        const manualExpenses = entries.filter((e: any) => e.type === "saida" && e.category !== "Salários").reduce((s: number, e: any) => s + e.amount, 0);
        const m = (c as any).Month;
        const salaries = (m?.year != null && m?.month != null) ? (salaryByMonth.get(`${m.year}-${m.month}`) ?? 0) : 0;
        const totalExpenses = manualExpenses + salaries;
        const totalTaxes = entries.filter((e: any) => e.type === "imposto").reduce((s: number, e: any) => s + e.amount, 0);
        const balance = totalEntries - totalExpenses - totalTaxes;
        const profitMargin = totalEntries > 0 ? (balance / totalEntries) * 100 : 0;
        const { FinancialEntry, ...rest } = c as any;
        return {
          ...rest,
          monthName: c.Month?.name,
          monthYear: c.Month?.year,
          monthNumber: c.Month?.month,
          companyName: c.Company?.name,
          companyCnpj: c.Company?.cnpj,
          totalEntries,
          totalExpenses,
          totalTaxes,
          balance,
          profitMargin,
        };
      });

      return rep.send(formattedClosings);
    } catch (error: any) {
      return rep.code(500).send({ message: "Erro interno do servidor", error: error?.message });
    }
  });

  // Obter fechamento específico
  app.get("/closings/:id", { preHandler: requirePermission("closings.view") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
      const tenantId = req.user!.tenantId;

      const closing = await prisma.closing.findFirst({
        where: { id, tenantId },
        include: {
          Month: { select: { id: true, name: true, year: true, month: true } },
          Company: { select: { id: true, name: true, cnpj: true } },
          FinancialEntry: { orderBy: { date: "desc" } },
        },
      });

      if (!closing) return rep.code(404).send({ message: "Fechamento não encontrado" });
      return rep.send(closing);
    } catch {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Criar fechamento
  app.post("/closings", { preHandler: requirePermission("closings.create") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const data = createClosingSchema.parse(req.body);
      const tenantId = req.user!.tenantId;
      const companyId = data.companyId === undefined ? null : data.companyId;

      const month = await prisma.month.findFirst({ where: { id: data.monthId, tenantId } });
      if (!month) return rep.code(404).send({ message: "Mês não encontrado" });

      // Validar duplicidade
      const duplicate = await prisma.closing.findFirst({
        where: {
          tenantId,
          monthId: data.monthId,
          companyId: companyId ?? null,
          status: { not: "cancelado" },
        },
      });
      if (duplicate) {
        return rep.code(409).send({ message: "Já existe um fechamento aberto para este mês e empresa" });
      }

      if (companyId != null) {
        const company = await prisma.company.findFirst({ where: { id: companyId, tenantId } });
        if (!company) return rep.code(404).send({ message: "Empresa não encontrada" });
      }

      const newClosing = await prisma.closing.create({
        data: {
          monthId: data.monthId,
          companyId,
          name: data.name,
          status: "aberto",
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          tenantId,
        },
        include: {
          Month: { select: { id: true, name: true, year: true, month: true } },
          Company: { select: { id: true, name: true, cnpj: true } },
        },
      });

      return rep.code(201).send(newClosing);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        const msg = error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return rep.code(400).send({ message: msg });
      }
      return rep.code(500).send({ message: "Erro interno do servidor", error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  });

  // Atualizar fechamento
  app.put("/closings/:id", { preHandler: requirePermission("closings.update") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
      const data = updateClosingSchema.parse(req.body);
      const tenantId = req.user!.tenantId;

      const existing = await prisma.closing.findFirst({ where: { id, tenantId } });
      if (!existing) return rep.code(404).send({ message: "Fechamento não encontrado" });

      const updatedClosing = await prisma.closing.update({
        where: { id },
        data: { name: data.name, startDate: data.startDate, endDate: data.endDate, status: data.status },
        include: {
          Month: { select: { id: true, name: true, year: true, month: true } },
          Company: { select: { id: true, name: true, cnpj: true } },
        },
      });

      return rep.send(updatedClosing);
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor", error: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  });

  // Deletar fechamento
  app.delete("/closings/:id", { preHandler: requirePermission("closings.delete") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
      const tenantId = req.user!.tenantId;

      const closing = await prisma.closing.findFirst({ where: { id, tenantId } });
      if (!closing) return rep.code(404).send({ message: "Fechamento não encontrado" });
      if (closing.status === "fechado") {
        return rep.code(400).send({ message: "Não é possível deletar um fechamento que já foi fechado" });
      }

      await prisma.closing.delete({ where: { id } });
      return rep.send({ message: "Fechamento deletado com sucesso" });
    } catch {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Fechar fechamento — FIX: agora tem permissão + inclui salários no snapshot
  app.post("/closings/:id/close", { preHandler: requirePermission("closings.update") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
      const tenantId = req.user!.tenantId;

      const closing = await prisma.closing.findFirst({
        where: { id, tenantId },
        include: {
          FinancialEntry: true,
          Month: { select: { year: true, month: true } },
        },
      });

      if (!closing) return rep.code(404).send({ message: "Fechamento não encontrado" });
      if (closing.status === "fechado") return rep.code(400).send({ message: "Fechamento já está fechado" });

      const totalEntries = closing.FinancialEntry
        .filter((e) => e.type === "entrada")
        .reduce((s, e) => s + e.amount, 0);

      const manualExpenses = closing.FinancialEntry
        .filter((e) => e.type === "saida" && e.category !== "Salários")
        .reduce((s, e) => s + e.amount, 0);

      const totalTaxes = closing.FinancialEntry
        .filter((e) => e.type === "imposto")
        .reduce((s, e) => s + e.amount, 0);

      // Calcular salários do mês e criar snapshot como FinancialEntry
      let salaryTotal = 0;
      const monthData = closing.Month as { year: number; month: number } | null;
      if (monthData?.year != null && monthData?.month != null) {
        const { total: computed, entries: salaryList } = await calcMonthSalaries(tenantId, monthData.year, monthData.month);
        salaryTotal = computed;

        // Remover snapshots anteriores (evitar duplicidade em fechamentos que foram reabertos)
        await prisma.financialEntry.deleteMany({
          where: { closingId: id, category: "Salários", tenantId },
        });

        // Criar entradas de salário como snapshot imutável
        if (salaryList.length > 0) {
          const endOfMonth = new Date(monthData.year, monthData.month, 0, 23, 59, 59, 999);
          await prisma.financialEntry.createMany({
            data: salaryList.map((s) => ({
              description: `Salário - ${s.name} (${String(monthData.month).padStart(2, "0")}/${monthData.year})`,
              amount: s.amount,
              category: "Salários",
              date: endOfMonth,
              type: "saida",
              closingId: id,
              companyId: null,
              tenantId,
            })),
          });
        }
      }

      const totalExpenses = manualExpenses + salaryTotal;
      const balance = totalEntries - totalExpenses - totalTaxes;
      const profitMargin = totalEntries > 0 ? (balance / totalEntries) * 100 : 0;

      const updatedClosing = await prisma.closing.update({
        where: { id },
        data: { status: "fechado", totalEntries, totalExpenses, totalTaxes, balance, profitMargin },
        include: {
          Month: { select: { id: true, name: true, year: true, month: true } },
          Company: { select: { id: true, name: true, cnpj: true } },
        },
      });

      return rep.send(updatedClosing);
    } catch (error) {
      console.error("Erro ao fechar fechamento:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Reabrir fechamento — FIX: agora verifica tenantId + remove snapshot de salários
  app.post("/closings/:id/reopen", { preHandler: requirePermission("closings.update") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
      const tenantId = req.user!.tenantId;

      // FIX: era findUnique sem tenantId — qualquer tenant podia reabrir fechamento alheio
      const closing = await prisma.closing.findFirst({ where: { id, tenantId } });
      if (!closing) return rep.code(404).send({ message: "Fechamento não encontrado" });
      if (closing.status !== "fechado") {
        return rep.code(400).send({ message: "Apenas fechamentos fechados podem ser reabertos" });
      }

      // Remove snapshot de salários para que sejam recalculados ao fechar novamente
      await prisma.financialEntry.deleteMany({
        where: { closingId: id, category: "Salários", tenantId },
      });

      const updatedClosing = await prisma.closing.update({
        where: { id },
        data: { status: "aberto", totalEntries: undefined, totalExpenses: undefined, totalTaxes: undefined, balance: undefined, profitMargin: undefined },
        include: {
          Month: { select: { id: true, name: true, year: true, month: true } },
          Company: { select: { id: true, name: true, cnpj: true } },
        },
      });

      return rep.send({
        ...updatedClosing,
        monthName: (updatedClosing as any).Month?.name,
        monthYear: (updatedClosing as any).Month?.year,
        monthNumber: (updatedClosing as any).Month?.month,
        companyName: (updatedClosing as any).Company?.name,
        companyCnpj: (updatedClosing as any).Company?.cnpj,
      });
    } catch {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Entradas do fechamento — FIX: tenantId em employees + usa snapshot quando fechado
  app.get("/closings/:id/entries", { preHandler: requirePermission("closings.view") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
      const tenantId = req.user!.tenantId;

      const closing = await prisma.closing.findFirst({
        where: { id, tenantId },
        include: {
          Month: { select: { id: true, year: true, month: true } },
          FinancialEntry: {
            include: { Company: { select: { id: true, name: true, cnpj: true } } },
            orderBy: { date: "desc" },
          },
        },
      });

      if (!closing) return rep.code(404).send({ message: "Fechamento não encontrado" });

      const storedSalaries = closing.FinancialEntry.filter((e) => e.category === "Salários");
      const manualEntries = closing.FinancialEntry.filter((e) => e.category !== "Salários");

      let salaryEntries: any[] = storedSalaries;

      // Se aberto (sem snapshot), calcula dinamicamente
      if (closing.status !== "fechado" && storedSalaries.length === 0) {
        const monthData = closing.Month as { year: number; month: number } | null;
        if (monthData?.year != null && monthData?.month != null) {
          const endOfMonth = new Date(monthData.year, monthData.month, 0, 23, 59, 59, 999);
          const { entries: salaryList } = await calcMonthSalaries(tenantId, monthData.year, monthData.month);
          salaryEntries = salaryList.map((s) => ({
            id: `salary-${s.empId}`,
            description: `Salário - ${s.name} (${String(monthData.month).padStart(2, "0")}/${monthData.year})`,
            amount: s.amount,
            category: "Salários",
            date: endOfMonth,
            type: "saida",
            observations: null,
            closingId: closing.id,
            companyId: null,
            _isComputed: true,
            Company: null,
          }));
        }
      }

      const allEntries = [...manualEntries, ...salaryEntries]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return rep.send({
        closing: {
          id: closing.id,
          name: closing.name,
          status: closing.status,
          startDate: closing.startDate,
          endDate: closing.endDate,
          totalEntries: closing.totalEntries,
          totalExpenses: closing.totalExpenses,
          totalTaxes: closing.totalTaxes,
          balance: closing.balance,
          profitMargin: closing.profitMargin,
        },
        entries: allEntries,
      });
    } catch (error) {
      console.error("Erro ao buscar entradas:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Estatísticas do fechamento
  app.get("/closings/:id/stats", { preHandler: requirePermission("closings.view") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
      const tenantId = req.user!.tenantId;

      const closing = await prisma.closing.findFirst({
        where: { id, tenantId },
        include: { FinancialEntry: true, Month: true, Company: true },
      });

      if (!closing) return rep.code(404).send({ message: "Fechamento não encontrado" });

      const entriesByCategory = closing.FinancialEntry.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return rep.send({
        closing: { id: closing.id, name: closing.name, status: closing.status, startDate: closing.startDate, endDate: closing.endDate },
        stats: {
          totalEntries: closing.totalEntries,
          totalExpenses: closing.totalExpenses,
          totalTaxes: closing.totalTaxes,
          balance: closing.balance,
          profitMargin: closing.profitMargin,
          entriesCount: {
            entries: closing.FinancialEntry.filter((e) => e.type === "entrada").length,
            expenses: closing.FinancialEntry.filter((e) => e.type === "saida").length,
            taxes: closing.FinancialEntry.filter((e) => e.type === "imposto").length,
          },
          entriesByCategory,
        },
      });
    } catch {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // ── AUTOMAÇÃO: Fechar mês completo ────────────────────────────────────────
  // Recalcula + finaliza todos fechamentos de carga abertos → fecha caixa com snapshot
  app.post("/closings/close-month", { preHandler: requirePermission("closings.update") }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { monthId } = z.object({ monthId: z.coerce.number() }).parse(req.body);
      const tenantId = req.user!.tenantId;

      const month = await prisma.month.findFirst({ where: { id: monthId, tenantId } });
      if (!month) return rep.code(404).send({ message: "Mês não encontrado" });

      const results = {
        loadBillingClosingsFinalized: 0,
        loadBillingClosingsSkipped: 0,
        cashClosingCreated: false,
        cashClosingId: null as number | null,
      };

      // 1. Recalcular + finalizar fechamentos de carga abertos do mês
      const lbcs = await (prisma as any).loadBillingClosing.findMany({
        where: { tenantId, monthId, status: { not: "fechado" } },
      });

      for (const lbc of lbcs) {
        try {
          // Recalcular cargas
          const start = new Date(lbc.startDate);
          const end = new Date(lbc.endDate);
          const company = await prisma.company.findFirst({
            where: { id: lbc.companyId, tenantId },
            select: { id: true, commission: true, name: true },
          });
          if (!company) { results.loadBillingClosingsSkipped++; continue; }

          const loads = await prisma.load.findMany({
            where: { companyId: lbc.companyId, tenantId, date: { gte: start, lte: end } },
          });
          const totalGrossValue = loads.reduce((s: number, l: any) => s + (l.totalValue || 0), 0);
          const totalCommission = (totalGrossValue * (company.commission || 0)) / 100;
          const totalAdditionalCosts = loads.reduce((s: number, l: any) => s + (l.additionalCosts || 0), 0);
          const billingTotal = totalCommission + totalAdditionalCosts;

          await (prisma as any).loadBillingClosing.update({
            where: { id: lbc.id },
            data: {
              totalLoads: loads.length,
              totalGrossValue,
              totalFreight: loads.reduce((s: number, l: any) => s + (l.totalFreight || l.freight4 || 0), 0),
              commissionRate: company.commission || 0,
              totalCommission,
              totalAdditionalCosts,
              billingTotal,
              totalDeliveries: loads.reduce((s: number, l: any) => s + (l.deliveries || 0), 0),
              totalWeight: loads.reduce((s: number, l: any) => s + (l.cargoWeight || 0), 0),
              status: "fechado",
            },
          });

          // Criar entrada no caixa (encontra ou cria Closing)
          if (billingTotal > 0) {
            let targetClosing = await prisma.closing.findFirst({
              where: { tenantId, monthId, OR: [{ companyId: lbc.companyId }, { companyId: null }] },
              orderBy: { createdAt: "desc" },
            });

            if (!targetClosing) {
              targetClosing = await prisma.closing.create({
                data: {
                  monthId,
                  companyId: lbc.companyId,
                  name: `Fechamento ${month.name ?? monthId}`,
                  status: "aberto",
                  tenantId,
                },
              });
              results.cashClosingCreated = true;
              results.cashClosingId = targetClosing.id;
            }

            // Evitar entrada duplicada
            const existingEntry = await prisma.financialEntry.findFirst({
              where: { tenantId, closingId: targetClosing.id, description: { contains: lbc.name } },
            });
            if (!existingEntry) {
              await prisma.financialEntry.create({
                data: {
                  description: `Fechamento de cargas: ${lbc.name}`,
                  amount: billingTotal,
                  category: "Fechamento de cargas",
                  date: end,
                  type: "entrada",
                  companyId: lbc.companyId,
                  closingId: targetClosing.id,
                  tenantId,
                },
              });
            }
          }

          results.loadBillingClosingsFinalized++;
        } catch {
          results.loadBillingClosingsSkipped++;
        }
      }

      // 2. Fechar o Closing do mês (ou criar se não existir)
      let mainClosing = await prisma.closing.findFirst({
        where: { tenantId, monthId, status: "aberto" },
        include: {
          FinancialEntry: true,
          Month: { select: { year: true, month: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!mainClosing) {
        const created = await prisma.closing.create({
          data: { monthId, companyId: null, name: `Fechamento ${month.name ?? monthId}`, status: "aberto", tenantId },
          include: {
            FinancialEntry: true,
            Month: { select: { year: true, month: true } },
          },
        });
        mainClosing = created;
        results.cashClosingCreated = true;
        results.cashClosingId = created.id;
      }

      // 3. Snapshot salários + fechar
      const monthData = mainClosing.Month as { year: number; month: number } | null;
      let salaryTotal = 0;
      if (monthData?.year != null && monthData?.month != null) {
        const { total, entries: salaryList } = await calcMonthSalaries(tenantId, monthData.year, monthData.month);
        salaryTotal = total;

        await prisma.financialEntry.deleteMany({
          where: { closingId: mainClosing.id, category: "Salários", tenantId },
        });

        if (salaryList.length > 0) {
          const endOfMonth = new Date(monthData.year, monthData.month, 0, 23, 59, 59, 999);
          await prisma.financialEntry.createMany({
            data: salaryList.map((s) => ({
              description: `Salário - ${s.name} (${String(monthData.month).padStart(2, "0")}/${monthData.year})`,
              amount: s.amount,
              category: "Salários",
              date: endOfMonth,
              type: "saida",
              closingId: mainClosing!.id,
              companyId: null,
              tenantId,
            })),
          });
        }
      }

      // Buscar entries atualizadas para calcular totais finais
      const freshEntries = await prisma.financialEntry.findMany({ where: { closingId: mainClosing.id, tenantId } });
      const totalEntries = freshEntries.filter((e) => e.type === "entrada").reduce((s, e) => s + e.amount, 0);
      const totalExpenses = freshEntries.filter((e) => e.type === "saida").reduce((s, e) => s + e.amount, 0);
      const totalTaxes = freshEntries.filter((e) => e.type === "imposto").reduce((s, e) => s + e.amount, 0);
      const balance = totalEntries - totalExpenses - totalTaxes;
      const profitMargin = totalEntries > 0 ? (balance / totalEntries) * 100 : 0;

      const closedClosing = await prisma.closing.update({
        where: { id: mainClosing.id },
        data: { status: "fechado", totalEntries, totalExpenses, totalTaxes, balance, profitMargin },
        include: {
          Month: { select: { id: true, name: true, year: true, month: true } },
          Company: { select: { id: true, name: true, cnpj: true } },
        },
      });

      return rep.send({
        message: "Mês fechado com sucesso",
        results: {
          ...results,
          cashClosingId: results.cashClosingId ?? mainClosing.id,
          cashClosing: { id: closedClosing.id, balance, totalEntries, totalExpenses, totalTaxes, salaryTotal },
        },
      });
    } catch (error) {
      console.error("Erro ao fechar mês:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
}
