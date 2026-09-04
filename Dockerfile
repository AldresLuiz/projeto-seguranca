FROM node:24.20

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

ENV NODE_ENV=production

EXPOSE 8444

CMD ["npm", "start"]