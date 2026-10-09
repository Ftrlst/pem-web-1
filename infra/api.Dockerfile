FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN corepack enable && pnpm install --frozen-lockfile

FROM dependencies AS build
WORKDIR /app
ARG DATABASE_URL=mysql://build:build@127.0.0.1:3306/build
ENV DATABASE_URL=$DATABASE_URL
COPY . .
RUN pnpm --filter @kletak/contracts build && pnpm db:generate && pnpm --filter @kletak/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/contracts ./packages/contracts
USER app
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
