#!/bin/sh
set -eu

if [ "${BOOTSTRAP_ENV:-}" = local ]; then
    if [ ! -f vendor/autoload.php ]; then
        composer install --no-interaction --no-progress
    fi

    if [ ! -f .env ]; then
        cp .env.example .env
    fi
    if ! grep -q '^APP_KEY=.' .env; then
        php artisan key:generate
    fi

    php artisan migrate --force
fi

exec docker-php-entrypoint "$@"
