<?php

namespace App\Console\Commands;

use App\Models\StaffAccount;
use Illuminate\Console\Command;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Creates the first Administrator (REQ-F-88). The install script (#66) runs it once with
 * --name and --email; a person running it by hand is asked for what is missing.
 */
class CreateAdministrator extends Command
{
    protected $signature = 'staff:create-admin
        {--name= : Full name, shown in the audit log}
        {--email= : Email the Administrator signs in with}
        {--locale=es : Language of the account, es or en}';

    protected $description = 'Create the first Administrator account and show its password once';

    public function handle(): int
    {
        // Admins invite everyone else (#84). A restore brings its own Administrators back.
        if (StaffAccount::query()->where('role', 'admin')->whereNull('deactivated_at')->exists()) {
            $this->error('An active Administrator already exists. Nothing was created.');

            return self::FAILURE;
        }

        $data = [
            'name' => trim((string) ($this->option('name') ?? $this->askIfInteractive('Full name'))),
            'email' => trim((string) ($this->option('email') ?? $this->askIfInteractive('Email'))),
            'locale' => $this->option('locale'),
        ];

        $validator = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'max:255', 'email:rfc'],
            'locale' => ['required', 'in:es,en'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        // Letters and digits only, so it is easy to type from the screen.
        $password = Str::password(20, symbols: false);

        try {
            // Its own transaction, so PostgreSQL rolls back only this insert when the email is taken.
            DB::transaction(fn () => StaffAccount::query()->create([...$data, 'role' => 'admin', 'password' => $password]));
        } catch (UniqueConstraintViolationException) {
            // The unique index ignores case (data-model.md section 5).
            $this->error('Another staff account already uses this email. Nothing was created.');

            return self::FAILURE;
        }

        $this->info("Administrator created for {$data['email']}.");
        $this->line("Password: {$password}");
        $this->warn('This password is shown only once. Give it to the Administrator now.');

        return self::SUCCESS;
    }

    private function askIfInteractive(string $question): ?string
    {
        return $this->input->isInteractive() ? $this->ask($question) : null;
    }
}
