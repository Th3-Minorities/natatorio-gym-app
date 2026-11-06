#!/bin/sh
set -eu

if [ "${BOOTSTRAP_ENV:-}" = local ]; then
    # Also after a pull that changes composer.lock. Not on every start: the optimized autoload rebuild is slow on Windows.
    if [ ! -f vendor/autoload.php ] || [ composer.lock -nt vendor/composer/installed.json ]; then
        COMPOSER_PROCESS_TIMEOUT=0 composer install --no-interaction --no-progress
        touch vendor/composer/installed.json
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
