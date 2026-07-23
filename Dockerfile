FROM oven/bun:alpine
WORKDIR /usr/src/app

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3 /lambda-adapter /opt/extensions/lambda-adapter

COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/

# Strip frontend workspace so Bun doesn't install frontend deps
RUN bun -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8'));p.workspaces=['packages/backend'];require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"

RUN bun install --frozen-lockfile --production

COPY packages/backend ./packages/backend

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /usr/src/app/packages/backend
CMD [ "bun", "run", "src/main.ts" ]
