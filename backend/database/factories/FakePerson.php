<?php

namespace Database\Factories;

use Illuminate\Support\Str;

/** A fake name with an email built from the same name, so seeded people never show a name and email of two different people. */
class FakePerson
{
    /** @var array<string, true> */
    private static array $used = [];

    /** @return array{name: string, email: string} */
    public static function make(string $domain = 'example.net'): array
    {
        do {
            $first = fake()->firstName();
            $last = fake()->lastName();
            $local = Str::slug("$first $last", '.');
        } while (isset(self::$used["$local@$domain"]));

        self::$used["$local@$domain"] = true;

        return ['name' => "$first $last", 'email' => "$local@$domain"];
    }
}
