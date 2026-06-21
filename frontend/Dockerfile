# --- Builder Stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install package descriptors and build dependencies
COPY package*.json ./
RUN npm ci

# Copy project source
COPY . .

# Set build-time argument for FastAPI connection
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Disable Next.js telemetry and compile
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runner Stage ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy compiled build artifacts and dependencies
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Run NextJS production server
CMD ["npm", "run", "start"]
