FROM node:18

WORKDIR /usr/app

COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm install
COPY ./ ./

CMD npm start