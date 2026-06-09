# Multi-stage build for the self-hosted Thuishaven MCP server.
#
# Build from the REPO ROOT (the image needs patterns/ and schema/):
#   docker build -f mcp-server/Dockerfile -t thuishaven-mcp .
#
# Run (HTTP transport, default):
#   docker run -p 3000:3000 thuishaven-mcp
# Run (stdio transport, for direct Claude Desktop/Code integration):
#   docker run -i thuishaven-mcp node mcp-server/dist/node-stdio.js
# Custom patterns directory (fork-and-customize):
#   docker run -p 3000:3000 -v /my/patterns:/app/patterns thuishaven-mcp

FROM node:22-alpine AS build
WORKDIR /app
COPY mcp-server/package.json mcp-server/package-lock.json ./mcp-server/
RUN cd mcp-server && npm ci
COPY schema ./schema
COPY patterns ./patterns
COPY mcp-server/tsconfig.json mcp-server/tsconfig.build.json ./mcp-server/
COPY mcp-server/src ./mcp-server/src
RUN cd mcp-server && npx tsc -p tsconfig.build.json

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY mcp-server/package.json mcp-server/package-lock.json ./mcp-server/
RUN cd mcp-server && npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/mcp-server/dist ./mcp-server/dist
COPY schema ./schema
COPY patterns ./patterns
USER node
EXPOSE 3000
CMD ["node", "mcp-server/dist/node-http.js"]
