import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.OWNER_NAME;
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;

  if (!name || !email || !password) {
    console.error("Defina OWNER_NAME, OWNER_EMAIL e OWNER_PASSWORD no .env antes de rodar.");
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
  if (existing) {
    console.error(`Já existe um owner cadastrado (id: ${existing.id}, email: ${existing.email}). Abortando.`);
    process.exit(1);
  }

  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken) {
    console.error(`E-mail ${email} já está em uso por outro usuário.`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);

  const owner = await (prisma.user.create as any)({
    data: {
      name,
      email,
      password: hashed,
      status: "active",
      isSuperAdmin: true,
    },
    select: { id: true, name: true, email: true, isSuperAdmin: true },
  });

  console.log("Owner criado com sucesso:");
  console.log(owner);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
