# Etapa de construcción
FROM node:20-slim AS builder

# Railway/CI no debe ejecutar operaciones interactivas de pnpm.
ENV CI=true

RUN npm install -g pnpm@10.26.1
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build:railway

# --- Segunda etapa: imagen de producción ---
FROM node:20-slim
WORKDIR /app

# Dejamos pnpm instalado también en la imagen final como protección adicional.
# Así, aunque Railway conserve un Start Command antiguo basado en pnpm,
# el contenedor seguirá pudiendo arrancar.
ENV CI=true
RUN npm install -g pnpm@10.26.1

COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

EXPOSE 8080
CMD ["node", "artifacts/api-server/dist/index.cjs"]
