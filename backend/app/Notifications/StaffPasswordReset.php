<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The staff password reset email (REQ-F-88, N-11). */
class StaffPasswordReset extends Notification
{
    public function __construct(public readonly string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $locale = $notifiable->locale === 'en' ? 'en' : 'es';
        $text = trans('staff_mail.reset', [], $locale);
        $url = rtrim(config('app.url'), '/').'/staff/restablecer?'.http_build_query(['token' => $this->token, 'email' => $notifiable->email]);

        return (new MailMessage)->subject($text['subject'])
            ->view('mail.staff-password-reset', ['texts' => $text, 'url' => $url, 'locale' => $locale]);
    }
}
