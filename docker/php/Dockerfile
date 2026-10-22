FROM php:8.3.20-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libpq5 \
    && docker-php-ext-install pdo_pgsql \
    && apt-get purge -y --auto-remove libpq-dev \
    && rm -rf /var/lib/apt/lists/*
# Private photos live outside the code folder, in a volume PHP-FPM can write to.
RUN mkdir -p /var/www/private && chown www-data:www-data /var/www/private
