<?php

// The roster download, Word and PDF (REQ-F-100, E-140). The file is made on the server, so its texts live here.
return [
    'title' => 'Roster de atletas',
    'file' => 'roster-atletas',
    'made' => 'Generado el :date. Todos los atletas, activos y retirados.',
    'count' => '{1} 1 atleta|[0,*] :count atletas',
    'columns' => [
        'name' => 'Nombre',
        'sport' => 'Deporte',
        'student_number' => 'Núm. estudiante',
        'email' => 'Correo institucional',
        'status' => 'Estado',
    ],
    'status' => ['active' => 'Activo', 'withdrawn' => 'Retirado'],
    'months' => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    'date' => ':day :month :year',
    'private' => 'Contiene datos personales de estudiantes. No lo compartas fuera del Departamento.',
];
