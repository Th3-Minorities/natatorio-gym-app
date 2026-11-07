<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class UserPasswordReset extends Notification
{
    public function __construct(public readonly string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $locale = $notifiable->locale === 'en' ? 'en' : 'es';
        $text = trans('user_mail', [], $locale);
        $url = rtrim(config('app.url'), '/').'/reset-password?'.http_build_query(['token' => $this->token, 'email' => $notifiable->email]);

        return (new MailMessage)->subject($text['subject'])
            ->view('mail.user-password-reset', ['texts' => $text, 'url' => $url, 'locale' => $locale]);
    }
}
