FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11.5.2

COPY package.json ./

RUN pnpm install

COPY . .

RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pnpm@11.5.2

COPY package.json ./

RUN pnpm install --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main.js"]
