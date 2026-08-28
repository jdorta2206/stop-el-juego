# Etapa de construcción
FROM node:20-slim AS builder

# Usar la misma versión de pnpm declarada por el proyecto.
RUN npm install -g pnpm@10.26.1

WORKDIR /app

# Copiar el repositorio completo para que pnpm vea todos los workspaces.
COPY . .

# Instalación limpia del workspace. El frontend usa Tailwind 4 mediante @tailwindcss/vite.
RUN rm -rf node_modules artifacts/*/node_modules lib/*/node_modules lib/*/*/node_modules
RUN pnpm install --no-frozen-lockfile --force
RUN pnpm --filter @workspace/stop-game... install --no-frozen-lockfile --force

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

RUN npm install -g pnpm@10.26.1

EXPOSE 8080

CMD ["pnpm", "run", "start:railway"]
