FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json /app

RUN npm install

COPY . /app

CMD ["node", "src/operator/index.js"]
