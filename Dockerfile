# Etapa de construcción
FROM node:20-slim AS builder

# Instalar pnpm globalmente
RUN npm install -g pnpm

WORKDIR /app

# Copiar TODOS los archivos del repositorio (incluye todos los workspaces)
COPY . .

# Instalar dependencias (sin --frozen-lockfile)
RUN pnpm install --no-frozen-lockfile

# Construir el frontend y el backend
RUN pnpm run build:railway

# --- Segunda etapa: imagen ligera para producción ---
FROM node:20-slim

WORKDIR /app

# Copiar solo lo necesario desde el builder
COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

# Railway: el frontend ya queda copiado por build:railway en api-server/dist/public.
# El backend lo sirve desde el mismo proceso mediante SERVE_CLIENT=1.

# Instalar solo dependencias de producción (opcional, pero ahorra espacio)
RUN npm install -g pnpm && pnpm install --prod --no-frozen-lockfile

# Exponer el puerto que usa el backend
EXPOSE 8080

# Comando de inicio
CMD ["pnpm", "run", "start:railway"]
