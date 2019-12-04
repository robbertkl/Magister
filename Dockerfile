FROM robbertkl/node:latest
MAINTAINER Robbert Klarenbeek <robbertkl@renbeek.nl>

COPY package.json ./
RUN npm install
COPY . .

# https://github.com/simplyGits/MagisterJS/pull/150
# https://github.com/idiidk/magister-openid/pull/1
# https://github.com/idiidk/magister-openid/issues/2
RUN patch -p1 < urlfix.patch

ENTRYPOINT [ "node", "app" ]
CMD []
