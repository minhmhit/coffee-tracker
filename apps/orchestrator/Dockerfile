FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11.5.2

COPY package.json ./
COPY prisma ./prisma/

RUN pnpm approve-builds --all && pnpm install

COPY . .

RUN pnpm exec prisma generate
RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pnpm@11.5.2

COPY package.json ./
COPY prisma ./prisma/

RUN pnpm approve-builds --all && pnpm install --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3001

CMD ["node", "dist/main.js"]
