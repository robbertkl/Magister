# Magister

[![](https://badge.imagelayers.io/robbertkl/magister:latest.svg)](https://imagelayers.io/?images=robbertkl/magister:latest)

E-mail notifier for new grades posted on Magister

## Usage

The commands below runs a continuous check for new grades. To notify once for previous grades since a specific date, add the date as an argument to `node app` or as the docker run command.

Node.js:

```
export MAGISTER_SCHOOL=xxx
export MAGISTER_USERNAME=xxx
export MAGISTER_PASSWORD=xxx
export RECIPIENTS=recipient1@example.org,recipient2@example.org
export SENDER="Magister <magister@example.org>"
node app
```

Docker:

```
docker run -d --restart=always \
  -e MAGISTER_SCHOOL=xxx \
  -e MAGISTER_USERNAME=xxx \
  -e MAGISTER_PASSWORD=xxx \
  -e RECIPIENTS=recipient1@example.org,recipient2@example.org \
  -e SENDER="Magister <magister@example.org>" \
  robbertkl/magister
```

Docker-compose:

```yaml
magister:
  image: robbertkl/magister
  restart: always
  environment:
    - MAGISTER_SCHOOL=xxx
    - MAGISTER_USERNAME=xxx
    - MAGISTER_PASSWORD=xxx
    - RECIPIENTS=recipient1@example.org,recipient2@example.org
    - SENDER="Magister <magister@example.org>"
```

## License

Published under the [MIT License](http://www.opensource.org/licenses/mit-license.php).
