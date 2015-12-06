FROM robbertkl/node
MAINTAINER Robbert Klarenbeek <robbertkl@renbeek.nl>

COPY package.json .
RUN npm install
COPY . .

ENTRYPOINT [ "node", "app" ]
CMD []
