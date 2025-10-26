# Multi-stage build to serve Animator Studio as a static site
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application sources and gather the files we need to serve
COPY . .

RUN mkdir -p /out \
	&& cp index.html app.js gifEncoder.js styles.css /out/ \
	&& cp -r modules images samples scenes /out/ \
	&& cp -r node_modules /out/

# Final runtime image uses nginx to serve static assets
FROM nginx:alpine
# Copy built app and runtime dependencies
COPY --from=deps /out/ /usr/share/nginx/html
# Expose HTTP port
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
