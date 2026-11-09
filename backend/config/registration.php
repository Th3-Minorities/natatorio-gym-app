<?php

return [
    // Provisional lookup limits; the team has not selected REG-1 and REG-2 values.
    'ip_failures' => 10,
    'global_failures' => 100,
    'window_seconds' => 900,
    'slow_milliseconds' => 500,
    'privacy_version' => 'draft',
    // Athlete email link (REQ-F-15). The limits are E-73. The validity is REG-6: 24 hours, decided by the team.
    'athlete_link_hours' => 24,
    'athlete_link_resend_seconds' => 300,
    'athlete_links_per_day' => 5,
    // DRAFT waiver approved by the team. The Department of Athletic Activities has not sent its official
    // text yet; replace the version and both texts when it arrives. Each text is the title, a blank line,
    // then one paragraph per blank-line-separated block.
    'waiver' => [
        'version' => 'borrador-2026-11-08',
        'es' => implode("\n\n", [
            'Relevo de responsabilidad',
            'Uso el Gimnasio de Pesas del Complejo Natatorio por mi propia voluntad. Entiendo que hacer ejercicio con pesas y máquinas tiene riesgo de lesión. Declaro que mi salud me permite hacer ejercicio y que consultaré a un profesional de la salud si tengo dudas.',
            'Me comprometo a seguir las reglas del gimnasio y las instrucciones del personal, a usar el equipo de forma correcta y a reportar cualquier equipo dañado.',
            'Libero a la Universidad de Puerto Rico, Recinto Universitario de Mayagüez, al Departamento de Actividades Atléticas y a su personal de responsabilidad por lesiones o pérdidas que resulten del uso normal de las instalaciones, excepto cuando se deban a negligencia de su parte.',
            'Autorizo al personal a llamar a mi contacto de emergencia y a pedir ayuda médica si la necesito.',
        ]),
        'en' => implode("\n\n", [
            'Release of liability',
            'I use the Weight Gym of the Natatorium Complex of my own free will. I understand that exercising with weights and machines carries a risk of injury. I declare that my health allows me to exercise and that I will consult a health professional if I have doubts.',
            "I agree to follow the gym rules and the staff's instructions, to use the equipment correctly and to report any damaged equipment.",
            'I release the University of Puerto Rico, Mayagüez Campus, the Department of Athletic Activities and its staff from liability for injuries or losses that result from the normal use of the facilities, except when they are due to their negligence.',
            'I authorize the staff to call my emergency contact and to request medical help if I need it.',
        ]),
    ],
];
