FROM composer:2.8.12 AS composer

FROM php:8.3.36-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libpq5 unzip \
    && docker-php-ext-install opcache pdo_pgsql \
    && apt-get purge -y --auto-remove libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer /usr/bin/composer /usr/bin/composer

# PHP errors go to the container logs, never to the client: production settings, plus ours.
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY app.ini "$PHP_INI_DIR/conf.d/zz-app.ini"
COPY opcache.ini "$PHP_INI_DIR/conf.d/zz-opcache.ini"

# The containers run as www-data, which cannot write to its home folder. Composer keeps its cache here.
ENV COMPOSER_HOME=/tmp/composer
# Composer stops a step (unzip, git) after 300 seconds. Unpacking a big package into a Windows folder
# through Docker Desktop can take longer than that, and the install fails with "exceeded the timeout".
ENV COMPOSER_PROCESS_TIMEOUT=1800
# Same for tools that save settings in the home folder, like tinker.
ENV HOME=/tmp
# Both folders are made now and owned by www-data. If a command run with "-u root" made them first,
# www-data could not write to them.
RUN install -d -o www-data -g www-data /tmp/composer /tmp/.config

# Private photos live outside the code folder, in a volume PHP-FPM can write to.
RUN mkdir -p /var/www/private && chown www-data:www-data /var/www/private
