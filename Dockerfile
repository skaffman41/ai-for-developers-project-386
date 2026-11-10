FROM node:24.22.2-bookworm-slim AS base
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json .npmrc ./
COPY backend/package.json backend/package.json
COPY contract/package.json contract/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY scripts/api.mjs scripts/api.mjs
COPY contract/ contract/
COPY frontend/ frontend/
COPY backend/ backend/
RUN npm run api:check && npm run build \
    && mkdir /app/data \
    && DATABASE_PATH=/app/data/calendar.sqlite node backend/dist/prepare.js

FROM base AS dependencies
COPY package.json package-lock.json .npmrc ./
COPY backend/package.json backend/package.json
COPY contract/package.json contract/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --workspace=backend --workspace=contract

FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/calendar.sqlite
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/contract/package.json ./contract/package.json
COPY --from=build /app/contract/dist ./contract/dist
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build --chown=node:node /app/data ./data
USER node
EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
