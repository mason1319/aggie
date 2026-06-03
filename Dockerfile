FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN mkdir -p public/media/videos public/media/teachers public/media/honorImg public/media/feedback public/media/audios src/data

EXPOSE 4173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4173"]
