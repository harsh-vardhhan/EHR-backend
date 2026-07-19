FROM oven/bun:1.3.14-alpine AS base
WORKDIR /usr/src/app

# Copy the Lambda Web Adapter binary from the official ECR image
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3 /lambda-adapter /opt/extensions/lambda-adapter

# Install dependencies inside the monorepo context
COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
RUN bun install --frozen-lockfile

# Copy source files and configuration
COPY packages/backend ./packages/backend
COPY ml ./ml

# Expose port and run
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /usr/src/app/packages/backend
CMD [ "bun", "run", "src/main.ts" ]
