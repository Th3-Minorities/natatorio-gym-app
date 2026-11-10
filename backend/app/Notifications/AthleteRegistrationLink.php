<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Sent to the roster email before any account exists, so the language comes from the registration screen. */
class AthleteRegistrationLink extends Notification
{
    public function __construct(public readonly string $token, public readonly string $language) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $locale = $this->language === 'en' ? 'en' : 'es';
        $text = trans('athlete_mail', [], $locale);
        $text['expiry'] = trans('athlete_mail.expiry', ['hours' => config('registration.athlete_link_hours')], $locale);
        $url = rtrim(config('app.url'), '/').'/register/athlete?'.http_build_query(['token' => $this->token]);

        return (new MailMessage)->subject($text['subject'])
            ->view('mail.athlete-registration-link', ['texts' => $text, 'url' => $url, 'locale' => $locale]);
    }
}
