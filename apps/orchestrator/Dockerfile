FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11.5.2

COPY package.json ./
COPY prisma ./prisma/

RUN printf "fetch-retries=5\nfetch-timeout=120000\nnetwork-concurrency=4\n" > .npmrc && pnpm install --ignore-scripts

COPY . .

RUN pnpm exec prisma generate
RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main.js"]
