FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Create the database directory and run migrations at startup
COPY .env ./
RUN npx prisma migrate deploy

EXPOSE 3000

CMD ["node", "dist/index.js"]
