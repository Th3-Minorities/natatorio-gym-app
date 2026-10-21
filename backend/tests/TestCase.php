<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * Runs before traits like RefreshDatabase, which wipe tables,
     * so tests can never touch the development database.
     */
    protected function setUpTraits()
    {
        $database = config('database.connections.'.config('database.default').'.database');

        if (! str_ends_with((string) $database, '_test')) {
            throw new RuntimeException("Tests must use a *_test database, not \"{$database}\". Check phpunit.xml.");
        }

        return parent::setUpTraits();
    }
}
