# Usar una imagen de Node con pnpm preinstalado
FROM node:20-slim AS builder

# Instalar pnpm globalmente
RUN npm install -g pnpm

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración del workspace
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml* ./

# Copiar los package.json de los workspaces
COPY artifacts/stop-game/package.json ./artifacts/stop-game/package.json
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json

# Instalar dependencias (sin --frozen-lockfile)
RUN pnpm install --no-frozen-lockfile

# Copiar el resto del código fuente
COPY . .

# Construir el frontend y el backend
RUN pnpm run build:railway

# Segunda etapa: imagen ligera para producción
FROM node:20-slim

WORKDIR /app

# Copiar solo lo necesario desde el builder
COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

# Instalar solo las dependencias de producción (opcional)
RUN npm install -g pnpm && pnpm install --prod --no-frozen-lockfile

# Exponer el puerto que usa el backend (Railway asigna el puerto)
EXPOSE 8080

# Comando de inicio (el mismo que antes)
CMD ["pnpm", "run", "start:railway"]
