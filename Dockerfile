# Etapa de construcción
FROM node:20-slim AS builder

RUN npm install -g pnpm
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build:railway

# --- Segunda etapa: imagen de producción ---
FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

# El builder ya contiene las dependencias instaladas.
# No volvemos a ejecutar pnpm install aquí: ese paso estaba provocando
# ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY en Railway.

EXPOSE 8080
CMD ["pnpm", "run", "start:railway"]
