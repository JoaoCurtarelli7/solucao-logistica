FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npx tsc

FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=builder /app/dist ./dist/

EXPOSE 3333
ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
