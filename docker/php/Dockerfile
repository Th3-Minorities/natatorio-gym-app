FROM composer:2.8.12 AS composer

FROM php:8.3.36-fpm-bookworm

# git lets Composer fall back to cloning a package when GitHub fails to serve its zip.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libpq5 unzip git \
    && docker-php-ext-install pdo_pgsql \
    && apt-get purge -y --auto-remove libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Imagick converts registration photos (JPEG, PNG, HEIC) to small JPEGs without location data (REQ-NF-24).
RUN apt-get update \
    && apt-get install -y --no-install-recommends $PHPIZE_DEPS libmagickwand-dev libheif1 \
    && pecl install imagick-3.8.1 \
    && docker-php-ext-enable imagick \
    && rm -rf /var/lib/apt/lists/* /tmp/pear

# zip and gd for PhpWord, which writes the Word roster download (REQ-F-100): a .docx is a zip file, and
# PhpWord 1.4, the first with a fixed phpoffice/math (CVE-2025-48882), needs gd.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libzip-dev libzip4 libpng-dev libpng16-16 \
    && docker-php-ext-install zip gd \
    && rm -rf /var/lib/apt/lists/*
# No purge of the -dev packages here: libpng-dev also holds up Imagick's libraries from the step above.

COPY --from=composer /usr/bin/composer /usr/bin/composer

# PHP errors go to the container logs, never to the client: production settings, plus ours.
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY app.ini "$PHP_INI_DIR/conf.d/zz-app.ini"
COPY entrypoint.sh /usr/local/bin/app-entrypoint
ENTRYPOINT ["sh", "/usr/local/bin/app-entrypoint"]
CMD ["php-fpm"]

# The containers run as www-data, which cannot write to its home folder. Composer keeps its cache here.
ENV COMPOSER_HOME=/tmp/composer
# Same for tools that save settings in the home folder, like tinker.
ENV HOME=/tmp

# Private photos live outside the code folder, in a volume PHP-FPM can write to.
RUN mkdir -p /var/www/private && chown www-data:www-data /var/www/private

# A new vendor volume (docker-compose.override.yml) copies this folder's owner, so Composer can write to it.
RUN mkdir -p /var/www/html/vendor && chown www-data:www-data /var/www/html/vendor
