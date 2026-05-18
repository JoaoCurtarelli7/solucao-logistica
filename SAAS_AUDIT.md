# Auditoria SaaS — Derlei Sistema

> Gerado em: 2026-05-15
> Stack: Fastify + Prisma + PostgreSQL | React + Ant Design
> Status atual: multi-tenant implementado (2026-05), 1 cliente em produção

---

## Como usar este arquivo

Cada item tem:
- **Prioridade**: 🔴 Crítico | 🟡 Importante | 🟢 Melhoria
- **Status**: `[ ]` pendente | `[x]` feito
- **Esforço estimado**: P (horas) | M (1-3 dias) | G (1 semana+)

---

## 1. SEGURANÇA

### 1.1 Rate Limiting
- [ ] 🔴 **Sem rate limiting nas rotas** — qualquer IP pode fazer brute-force em `/login` e `/public/register`
  - Esforço: P
  - Solução: `@fastify/rate-limit` — 10 req/min em auth, 100 req/min em rotas gerais
  - Arquivo: `backend/src/app.ts`

### 1.2 JWT Secret fraco
- [ ] 🔴 **JWT_SECRET default é `"supersecret"`** — produção com segredo exposto = todos tokens forjáveis
  - Esforço: P
  - Solução: validar `JWT_SECRET` no startup, mínimo 32 chars, lançar erro se ausente
  - Arquivo: `backend/src/lib/auth.ts`

### 1.3 Token no localStorage
- [ ] 🟡 **JWT em localStorage** — vulnerável a XSS; qualquer script malicioso acessa
  - Esforço: M
  - Solução: migrar para `httpOnly cookie` + refresh token strategy
  - Arquivo: `front/src/context/userContext.jsx`, `front/src/lib/api.js`

### 1.4 Sem validação de tamanho de payload
- [ ] 🟡 **Upload de PDF sem limite explícito verificado** — risco de DOS por arquivo grande
  - Esforço: P
  - Solução: confirmar/adicionar `attachFieldsLimit` e `fileSize` no multipart config
  - Arquivo: `backend/src/routes/` (rota de documento)

### 1.5 CORS muito permissivo em dev
- [ ] 🟢 **CORS_ORIGIN pode ser wildcard** — ok em dev, bloqueio explícito em prod obrigatório
  - Esforço: P
  - Solução: validar env `CORS_ORIGIN` e rejeitar `*` quando `NODE_ENV=production`

### 1.6 Sem proteção CSRF
- [ ] 🟢 **Sem CSRF token** — relevante se migrar para cookies
  - Esforço: M
  - Solução: `@fastify/csrf-protection` ao migrar para cookies

---

## 2. MULTI-TENANCY

### 2.1 Isolamento via WHERE clause — sem RLS no banco
- [ ] 🔴 **Isolamento feito só em código** — bug em qualquer query vaza dados entre tenants
  - Esforço: G
  - Solução: ativar Row-Level Security (RLS) no PostgreSQL como segunda camada
  ```sql
  ALTER TABLE "Load" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "Load"
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
  ```
  - Arquivo: nova migration `backend/prisma/migrations/`

### 2.2 tenantId não validado em algumas rotas
- [ ] 🔴 **Verificar se TODAS as rotas filtram por `req.user.tenantId`** — risco de tenant A ver dados do tenant B
  - Esforço: M
  - Solução: criar middleware global que garante `tenantId` em todos os `findMany`
  - Arquivos a auditar: `backend/src/routes/*.ts`

### 2.3 Sem limite de recursos por tenant
- [ ] 🟡 **Tenant pode criar usuários, cargas, empresas ilimitadas** — sem controle de cota
  - Esforço: M
  - Solução: campo `Tenant.plan` + tabela `PlanLimit` com limites por entidade
  - Arquivo: `backend/prisma/schema.prisma`

### 2.4 Email do usuário único global
- [ ] 🟡 **`User.email` tem unique constraint global** — email duplicado em tenants diferentes é bloqueado
  - Esforço: P
  - Solução: mudar constraint para `(email, tenantId)` se quiser permitir mesmo email em tenants distintos
  - Arquivo: `backend/prisma/schema.prisma`

### 2.5 Sem soft delete
- [ ] 🟢 **Deletes físicos** — excluir empresa/funcionário/carga apaga permanentemente
  - Esforço: M
  - Solução: campo `deletedAt` + filtro `deletedAt IS NULL` nas queries (soft delete)

---

## 3. PLANOS E COBRANÇA (SaaS Billing)

### 3.1 Sem modelo de planos/assinaturas
- [ ] 🔴 **Nenhuma lógica de plano ou cobrança por assinatura implementada**
  - Esforço: G
  - Solução mínima: 
    1. Adicionar `Tenant.plan` (free | basic | pro) + `Tenant.planExpiresAt`
    2. Criar middleware que bloqueia acesso se plano vencido
    3. Tela no superadmin para alterar plano
  - Arquivo: `backend/prisma/schema.prisma`, novo middleware

### 3.2 Sem integração de pagamento
- [ ] 🔴 **Sem Stripe/Mercado Pago/EBANX** — cobrança manual é inescalável
  - Esforço: G
  - Solução: integração com Stripe (global) ou Mercado Pago/EBANX (BR)
  - Entregas: webhook de pagamento → ativa/suspende tenant automaticamente

### 3.3 Sem histórico de cobrança por tenant
- [ ] 🟡 **Não há registro de pagamentos, invoices ou histórico financeiro do tenant**
  - Esforço: M
  - Solução: tabela `Subscription` + `Invoice` no schema
  ```prisma
  model Subscription {
    id          String   @id @default(uuid())
    tenantId    String
    plan        String
    status      String   // active | past_due | canceled
    startedAt   DateTime
    expiresAt   DateTime
    stripeSubId String?
    tenant      Tenant   @relation(fields: [tenantId], references: [id])
  }
  ```

### 3.4 Sem trial automático
- [ ] 🟡 **Novos tenants aprovados não têm período trial**
  - Esforço: P
  - Solução: ao aprovar tenant, setar `planExpiresAt = now() + 14 dias` + plano `trial`

---

## 4. ONBOARDING DE NOVOS CLIENTES

### 4.1 Fluxo de aprovação manual
- [ ] 🟡 **Todo tenant novo precisa aprovação manual do superadmin** — não escala
  - Esforço: M
  - Solução: auto-aprovação com trial de 14 dias + notificação por email para superadmin

### 4.2 Sem email de boas-vindas
- [ ] 🟡 **Após aprovação, tenant não recebe nenhuma comunicação**
  - Esforço: P
  - Solução: integrar `nodemailer` ou `Resend` — enviar email ao aprovar tenant
  - Arquivo: `backend/src/routes/auth.ts` (rota approve)

### 4.3 Sem wizard de configuração inicial
- [ ] 🟢 **Tenant aprovado cai direto no dashboard vazio** — experiência ruim
  - Esforço: M
  - Solução: wizard de onboarding no frontend (criar primeira empresa, primeiro caminhão)

### 4.4 Página de registro (`/solicitar-acesso`) sem feedback de status
- [ ] 🟢 **Após solicitar acesso, usuário não sabe o que acontece a seguir**
  - Esforço: P
  - Solução: página de "aguardando aprovação" + email de confirmação de recebimento

---

## 5. INFRAESTRUTURA E DEPLOY

### 5.1 Sem Docker / docker-compose
- [ ] 🔴 **Deploy manual sem containerização** — impossível replicar ambiente e escalar
  - Esforço: M
  - Solução: `Dockerfile` para backend + frontend, `docker-compose.yml` com PostgreSQL

### 5.2 Sem CI/CD pipeline
- [ ] 🔴 **Deploy feito manualmente** — sem automação de testes + deploy
  - Esforço: M
  - Solução: GitHub Actions — lint → test → build → deploy em push para `main`

### 5.3 Sem health check endpoint
- [ ] 🟡 **Sem `/health` ou `/ping`** — monitoramento externo (UptimeRobot, etc.) não funciona
  - Esforço: P
  - Solução: 
  ```typescript
  app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  ```

### 5.4 Sem graceful shutdown
- [ ] 🟡 **Processo Node finaliza abruptamente** — requests em andamento são cortados
  - Esforço: P
  - Arquivo: `backend/src/server.ts`
  ```typescript
  process.on('SIGTERM', async () => {
    await server.close()
    await prisma.$disconnect()
    process.exit(0)
  })
  ```

### 5.5 Sem estratégia de backup
- [ ] 🟡 **Backup do banco depende de processo manual**
  - Esforço: M
  - Solução: cron job diário com `pg_dump` + upload para S3/R2

### 5.6 Sem `.env.example`
- [ ] 🟢 **Novo dev não sabe quais variáveis configurar**
  - Esforço: P
  - Solução: criar `backend/.env.example` e `front/.env.example` com todas as vars e comentários

---

## 6. OBSERVABILIDADE

### 6.1 Sem rastreamento de erros (Sentry)
- [ ] 🔴 **Erros em produção não são capturados** — você descobre pelo cliente
  - Esforço: P
  - Solução: `@sentry/node` no backend + `@sentry/react` no frontend

### 6.2 Logs não estruturados
- [ ] 🟡 **Fastify loga em JSON mas sem correlação de request/tenant**
  - Esforço: P
  - Solução: adicionar `tenantId` e `userId` em todos os logs via `req.log.info({ tenantId, userId }, 'msg')`

### 6.3 Sem métricas de negócio
- [ ] 🟡 **Sem contagem de tenants ativos, MAU, uso de funcionalidades**
  - Esforço: M
  - Solução: tabela `UsageEvent` para eventos-chave (load criada, closing fechado, etc.)

### 6.4 Sem alerta de tenant inativo
- [ ] 🟢 **Tenant não usa o sistema por 30 dias — ninguém sabe**
  - Esforço: M
  - Solução: cron semanal que identifica tenants sem atividade + envia email de re-engajamento

---

## 7. PERFORMANCE

### 7.1 N+1 queries em listagens
- [ ] 🟡 **Verificar se listagens usam `include` ao invés de queries separadas**
  - Esforço: M
  - Solução: auditar routes e substituir loops de query por `include` no Prisma

### 7.2 Sem paginação em todas as listagens
- [ ] 🟡 **Listagens podem retornar todos os registros** — problema com tenant com muitos dados
  - Esforço: M
  - Solução: `?page=1&limit=20` em todas as rotas GET de listagem + resposta com `total`

### 7.3 Sem cache de dados frequentes
- [ ] 🟢 **Permissões buscadas do banco a cada request** (recarregadas no JWT mas ainda validadas)
  - Esforço: M
  - Solução: Redis com TTL de 5 minutos para permissions e roles

### 7.4 Múltiplas libs de data
- [ ] 🟢 **3 libs concorrentes: date-fns + dayjs + moment** — momento pesa 67kb gzip
  - Esforço: P
  - Solução: padronizar em `date-fns` ou `dayjs`, remover moment.js

---

## 8. QUALIDADE DE CÓDIGO E TESTES

### 8.1 Sem nenhum teste automatizado
- [ ] 🔴 **Zero testes** — qualquer refactor ou nova feature pode quebrar silenciosamente
  - Esforço: G
  - Solução mínima: testes de integração nas rotas críticas (auth, tenants, loads)
  - Ferramentas: Vitest + Supertest (backend), Vitest + Testing Library (frontend)

### 8.2 Rotas muito grandes
- [ ] 🟡 **`auth.ts` com 666 linhas** — difícil manter e testar
  - Esforço: M
  - Solução: extrair lógica para services (`AuthService`, `TenantService`)

### 8.3 Sem validação de schema nas rotas
- [ ] 🟡 **Algumas rotas usam Zod mas não todas** — inputs não validados geram erros inesperados
  - Esforço: M
  - Solução: Zod schema em todas as rotas POST/PUT, usar `fastify-type-provider-zod`

---

## 9. DOCUMENTAÇÃO E LEGAL

### 9.1 Sem documentação de API (Swagger)
- [ ] 🟡 **API sem docs** — impossível integração por terceiros, dificulta onboarding de devs
  - Esforço: M
  - Solução: `@fastify/swagger` + `@fastify/swagger-ui` — auto-gera de schemas existentes

### 9.2 Sem Termos de Serviço e Política de Privacidade
- [ ] 🟡 **SaaS sem ToS/PP** — obrigatório legalmente (LGPD) e para processadores de pagamento
  - Esforço: P (redigir com ajuda jurídica)
  - Exibir na página `/solicitar-acesso` com checkbox de aceite

### 9.3 Sem conformidade LGPD
- [ ] 🟡 **Dados pessoais (CPF, email, telefone) sem política de retenção**
  - Esforço: G
  - Solução: endpoint de exclusão de dados (direito ao esquecimento), log de consentimento

---

## 10. EXPERIÊNCIA DO SUPERADMIN

### 10.1 Sem dashboard SaaS para superadmin
- [ ] 🟡 **Página `/admin` existe mas só mostra lista de tenants**
  - Esforço: M
  - Solução: adicionar KPIs de negócio: tenants ativos, MRR, novos cadastros, tenants em trial

### 10.2 Sem impersonação de tenant
- [ ] 🟢 **Superadmin não consegue "entrar" na conta de um tenant para suporte**
  - Esforço: M
  - Solução: rota `POST /tenants/:id/impersonate` → retorna JWT com tenantId do cliente

---

## ROADMAP SUGERIDO

### Fase 1 — Segurança Básica ✅ CONCLUÍDA
1. [x] Rate limiting em auth (10 req/min login, 5 req/5min registro, 200 req/min global)
2. [x] Validar JWT_SECRET no startup (aviso dev, fatal em prod)
3. [x] Health check endpoint (`GET /health`)
4. [x] Graceful shutdown (SIGTERM/SIGINT)
5. [x] `.env.example` nos dois projetos
6. [ ] Sentry (backend + frontend) — requer DSN do projeto

### Fase 2 — Billing Mínimo ✅ PARCIALMENTE CONCLUÍDA
1. [x] Modelo de planos no schema (`Tenant.plan`, `Tenant.planExpiresAt`, tabela `Subscription`)
2. [x] Trial de 14 dias automático no approve
3. [x] Middleware de verificação de plano (integrado ao authMiddleware — 402 em plano expirado)
4. [x] Email de boas-vindas ao aprovar (emailService com nodemailer — requer SMTP_* no .env)
5. [x] Admin panel mostra plano/trial de cada tenant com status visual
6. [ ] Integração Mercado Pago ou Stripe — próxima fase

### Fase 3 — Infraestrutura ✅ PARCIALMENTE CONCLUÍDA
1. [x] Docker + docker-compose (backend + frontend + postgres, nginx com SPA routing)
2. [x] GitHub Actions CI/CD (lint + typecheck + build + docker build check)
3. [ ] Backup automático do banco — próxima etapa
4. [x] Paginação nas rotas principais (employees, companies, loads, trips — ?page=&limit=&search= opcional, backward compat)

### Fase 4 — Qualidade e Escala (ongoing)
1. [ ] Testes automatizados nas rotas críticas
2. [ ] RLS no PostgreSQL
3. [ ] Refatorar rotas grandes em services
4. [x] Swagger/OpenAPI — disponível em /docs (JWT auth já configurado no UI)
5. [ ] ToS + Política de Privacidade (LGPD)

---

## RESUMO POR PRIORIDADE

| # | Item | Prioridade | Esforço | Status |
|---|------|-----------|---------|--------|
| 1 | Rate limiting em /login | 🔴 | P | [x] |
| 2 | Validar JWT_SECRET forte | 🔴 | P | [x] |
| 3 | Modelo de planos/assinaturas | 🔴 | G | [x] |
| 4 | Integração de pagamento | 🔴 | G | [ ] |
| 5 | Testes automatizados | 🔴 | G | [ ] |
| 6 | Docker + CI/CD | 🔴 | M | [ ] |
| 7 | Sentry (error tracking) | 🔴 | P | [ ] |
| 8 | RLS no PostgreSQL | 🔴 | G | [ ] |
| 9 | Trial automático (14 dias) | 🟡 | P | [x] |
| 10 | Email boas-vindas | 🟡 | P | [x] |
| 11 | Health check endpoint | 🟡 | P | [x] |
| 12 | Graceful shutdown | 🟡 | P | [x] |
| 13 | Paginação nas listagens | 🟡 | M | [x] |
| 14 | Swagger/OpenAPI docs | 🟡 | M | [x] |
| 15 | ToS + LGPD compliance | 🟡 | M | [ ] |
| 16 | Soft delete | 🟢 | M | [ ] |
| 17 | Wizard de onboarding | 🟢 | M | [ ] |
| 18 | Redis cache | 🟢 | M | [ ] |
| 19 | Remover moment.js | 🟢 | P | [x] |
| 20 | Dashboard SaaS superadmin | 🟢 | M | [ ] |
