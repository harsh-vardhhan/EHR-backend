FROM oven/bun:alpine
WORKDIR /usr/src/app

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3 /lambda-adapter /opt/extensions/lambda-adapter

COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/
RUN bun install --frozen-lockfile --production

COPY packages/backend ./packages/backend

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /usr/src/app/packages/backend
CMD [ "bun", "run", "src/main.ts" ]
