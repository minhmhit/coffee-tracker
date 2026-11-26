FROM node:22-alpine AS builder

WORKDIR /app
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

RUN npm install -g pnpm@11.5.2

COPY package.json ./
COPY prisma ./prisma/

RUN printf "fetch-retries=8\nfetch-timeout=300000\nnetwork-concurrency=2\n" > .npmrc && pnpm install --ignore-scripts

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
