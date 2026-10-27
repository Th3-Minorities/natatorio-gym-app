<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class MailInTestsTest extends TestCase
{
    /**
     * Docker sets MAIL_MAILER=smtp (Mailpit), and CI runs without Mailpit.
     * Tests must keep mail in memory, even without Mail::fake().
     */
    public function test_mail_sent_in_tests_stays_in_memory(): void
    {
        $this->assertSame('array', config('mail.default'));

        Mail::raw('Hello', fn ($message) => $message->to('student@example.com')->subject('Test'));

        $this->assertCount(1, Mail::mailer()->getSymfonyTransport()->messages());
    }
}
