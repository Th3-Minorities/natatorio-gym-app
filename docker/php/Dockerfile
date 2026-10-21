FROM php:8.3.20-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libpq5 \
    && docker-php-ext-install pdo_pgsql \
    && apt-get purge -y --auto-remove libpq-dev \
    && rm -rf /var/lib/apt/lists/*