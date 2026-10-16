FROM node:22-alpine AS dependencies
WORKDIR /app
ARG PNPM_VERSION=12.6.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm install -g "pnpm@${PNPM_VERSION}" && pnpm install --frozen-lockfile

FROM dependencies AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN pnpm --filter @kletak/contracts build && pnpm --filter @kletak/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/package.json ./package.json
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["../../node_modules/.bin/next", "start", "-p", "3000"]
