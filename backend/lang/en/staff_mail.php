<?php

return [
    'invitation' => [
        'subject' => 'Invitation to the gym team',
        'greeting' => 'Hello',
        'description' => 'You were invited to the RUM Weight Room team. Create your password to open the staff dashboard.',
        'action' => 'Create your password',
        'expiry' => 'The link expires in 7 days and can only be used once.',
        'ignore' => 'If you were not expecting this invitation, you can ignore this email.',
        'salutation' => 'RUM Weight Room',
    ],
    'reset' => [
        'subject' => 'Reset password',
        'greeting' => 'Hello',
        'description' => 'We received a request to reset the password of your gym team account.',
        'action' => 'Reset password',
        'expiry' => 'The link expires in 60 minutes and can only be used once. Changing it signs you out everywhere.',
        'ignore' => 'If you did not request this change, you can ignore this email.',
        'salutation' => 'RUM Weight Room',
    ],
];
