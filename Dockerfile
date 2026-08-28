# Etapa de construcción
FROM node:20-slim AS builder

RUN npm install -g pnpm

WORKDIR /app

# Copiar el repositorio completo para que pnpm vea todos los workspaces.
COPY . .

# Evitar que una instalación cacheada/incompleta deje fuera dependencias del frontend.
RUN rm -rf node_modules artifacts/*/node_modules lib/*/node_modules lib/*/*/node_modules
RUN pnpm install --no-frozen-lockfile --force

# Construir exactamente la versión de producción.
RUN pnpm run build:railway

# --- Segunda etapa: imagen de producción ---
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/lib /app/lib
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

RUN npm install -g pnpm

EXPOSE 8080

CMD ["pnpm", "run", "start:railway"]
