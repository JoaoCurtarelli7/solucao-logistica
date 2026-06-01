import nodemailer from "nodemailer";

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@derlei.com.br";

export async function sendWelcomeEmail(to: string, name: string, tenantName: string, trialEndsAt: Date) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[email] SMTP não configurado, pulando envio de boas-vindas.");
    return;
  }

  const trialDate = trialEndsAt.toLocaleDateString("pt-BR");
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `Derlei Sistema <${FROM}>`,
    to,
    subject: "Bem-vindo ao Derlei Sistema! Sua conta foi aprovada",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">Olá, ${name}!</h2>
        <p>Sua conta <strong>${tenantName}</strong> foi aprovada e já está ativa.</p>
        <p>Você tem acesso gratuito até <strong>${trialDate}</strong>.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.APP_URL || "http://localhost:3000"}/login"
             style="background:#1a1a2e; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">
            Acessar o sistema
          </a>
        </p>
        <p style="color:#666; margin-top: 24px; font-size: 13px;">
          Em caso de dúvidas, entre em contato com o suporte.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // Em dev: loga o link no console para teste sem SMTP
    console.warn(`[email:reset] SMTP não configurado. Link de reset para ${to}:`);
    console.warn(`[email:reset] ${resetUrl}`);
    return;
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `Derlei Sistema <${FROM}>`,
    to,
    subject: "Redefinição de senha — Derlei Sistema",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">Olá, ${name}!</h2>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p>Clique no botão abaixo para criar uma nova senha. Este link expira em <strong>15 minutos</strong>.</p>
        <p style="margin-top: 24px;">
          <a href="${resetUrl}"
             style="background:#1a1a2e; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">
            Redefinir senha
          </a>
        </p>
        <p style="color:#666; margin-top: 24px; font-size: 13px;">
          Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.
        </p>
      </div>
    `,
  });
}

export async function sendPlanExpiringEmail(to: string, name: string, daysLeft: number) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `Derlei Sistema <${FROM}>`,
    to,
    subject: `Seu trial expira em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">Olá, ${name}!</h2>
        <p>Seu período de trial expira em <strong>${daysLeft} dia${daysLeft !== 1 ? "s" : ""}</strong>.</p>
        <p>Entre em contato com o administrador para renovar seu acesso.</p>
        <p style="margin-top: 24px;">
          <a href="${process.env.APP_URL || "http://localhost:3000"}/login"
             style="background:#1a1a2e; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">
            Acessar o sistema
          </a>
        </p>
      </div>
    `,
  });
}
