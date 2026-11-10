{{-- The PDF roster (REQ-F-100). Dompdf reads this page with remote files and PHP turned off; every value is escaped. --}}
<!DOCTYPE html>
<html lang="{{ $locale }}">
<head>
    <meta charset="utf-8">
    <title>{{ $texts['title'] }}</title>
    <style>
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; color: #25291e; }
        h1 { font-size: 16pt; margin: 0 0 4pt; }
        p { margin: 0 0 8pt; color: #616653; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 4pt 6pt; border-bottom: 1px solid #d9dccb; vertical-align: top; }
        th { background: #f7f5ed; color: #616653; font-weight: bold; }
    </style>
</head>
<body>
    <h1>{{ $texts['title'] }}</h1>
    <p>{{ $made }} {{ $count }}</p>
    <table>
        <thead>
            <tr>
                @foreach ($texts['columns'] as $column)
                    <th>{{ $column }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $row)
                <tr>
                    @foreach ($row as $value)
                        <td>{{ $value }}</td>
                    @endforeach
                </tr>
            @endforeach
        </tbody>
    </table>
    <p style="margin-top: 12pt">{{ $texts['private'] }}</p>
</body>
</html>
