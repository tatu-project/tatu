FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

# better-sqlite3 may need to compile its native addon when no matching
# prebuild is available for the selected Node.js image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN npm ci
RUN npm run build -- --force
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/research/package.json ./packages/research/package.json
COPY --from=build /app/packages/research/dist ./packages/research/dist
COPY --from=build /app/packages/storage/package.json ./packages/storage/package.json
COPY --from=build /app/packages/storage/dist ./packages/storage/dist

RUN mkdir -p /app/data/deliveries && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
