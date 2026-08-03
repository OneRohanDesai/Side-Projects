FROM python:3.12-alpine

RUN apk add --no-cache bash

WORKDIR /app

COPY country.sh .
COPY regions.sh .

RUN chmod +x country.sh

CMD ["sh","/app/country.sh"]