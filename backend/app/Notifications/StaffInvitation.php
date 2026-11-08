<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The invitation email with the link to set a password (REQ-F-88). */
class StaffInvitation extends Notification
{
    public function __construct(public readonly string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $locale = $notifiable->locale === 'en' ? 'en' : 'es';
        $text = trans('staff_mail.invitation', [], $locale);
        $url = rtrim(config('app.url'), '/').'/staff/invitacion?'.http_build_query(['token' => $this->token]);

        return (new MailMessage)->subject($text['subject'])
            ->view('mail.staff-invitation', ['texts' => $text, 'url' => $url, 'locale' => $locale]);
    }
}
