import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.OWNER_NAME;
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) {
    console.error("Defina OWNER_EMAIL e OWNER_PASSWORD antes de rodar.");
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
  if (!existing) {
    console.error("Nenhum owner encontrado. Rode create-owner.ts primeiro.");
    process.exit(1);
  }

  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken && emailTaken.id !== existing.id) {
    console.error(`E-mail ${email} já está em uso por outro usuário (id: ${emailTaken.id}).`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(name ? { name } : {}),
      email,
      password: hashed,
    },
    select: { id: true, name: true, email: true, isSuperAdmin: true },
  });

  console.log("Owner atualizado:");
  console.log(updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
