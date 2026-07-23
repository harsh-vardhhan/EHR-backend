# --- Stage 1: Build & Bundle ---
FROM oven/bun:alpine AS builder
WORKDIR /usr/src/app

COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
RUN bun install --frozen-lockfile

COPY packages/backend ./packages/backend
WORKDIR /usr/src/app/packages/backend
RUN bun build ./src/main.ts --target=bun --outfile=dist/main.js

# --- Stage 2: Minimal Runtime Image ---
FROM oven/bun:alpine AS runner
WORKDIR /usr/src/app

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3 /lambda-adapter /opt/extensions/lambda-adapter

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

COPY --from=builder /usr/src/app/packages/backend/dist/main.js ./packages/backend/dist/main.js

USER bun

WORKDIR /usr/src/app/packages/backend
CMD [ "bun", "run", "dist/main.js" ]
