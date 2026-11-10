<?php

return [
    'title' => 'Athlete roster',
    'file' => 'athlete-roster',
    'made' => 'Made on :date. Every athlete, active and withdrawn.',
    'count' => '{1} 1 athlete|[0,*] :count athletes',
    'columns' => [
        'name' => 'Name',
        'sport' => 'Sport',
        'student_number' => 'Student no.',
        'email' => 'Institutional email',
        'status' => 'Status',
    ],
    'status' => ['active' => 'Active', 'withdrawn' => 'Withdrawn'],
    'months' => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'date' => ':month :day, :year',
    'private' => 'Contains personal student data. Do not share it outside the Department.',
];
