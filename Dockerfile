# Build stage for Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production stage for Backend & Frontend Static Files
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_PROVIDER=local
ENV LOCAL_STORAGE_DIR=/app/data/uploads

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend output
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "src/server.js"]
