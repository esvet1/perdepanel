FROM node:20-alpine
WORKDIR /app
COPY server.js index.html ./
ENV PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "server.js"]
