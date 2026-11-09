<?php

namespace App\Http\Controllers;

use App\Models\RosterRecord;
use App\Models\StaffAccount;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Settings;
use PhpOffice\PhpWord\Style\Language;
use Symfony\Component\HttpFoundation\Response;

/**
 * The whole athlete roster as a Word or PDF file, for Administrators only (REQ-F-100, E-140, A-05 4039:2032).
 * Every athlete, active and withdrawn, whatever the table shows. The file is built on the server, so Staff never
 * receive the roster (the team's answer on #21).
 */
class RosterDownloadController extends Controller
{
    private const TYPES = [
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'pdf' => 'application/pdf',
    ];

    public function __invoke(Request $request): Response
    {
        $format = $request->validate(['format' => ['required', 'string', Rule::in(array_keys(self::TYPES))]])['format'];
        $data = $this->pageData($request->user('staff'));
        $content = $format === 'docx' ? $this->word($data) : $this->pdf($data);
        $name = $data['texts']['file'].'-'.Carbon::now()->format('Y-m-d').'.'.$format;

        return response($content, 200, [
            'Content-Type' => self::TYPES[$format],
            'Content-Disposition' => "attachment; filename={$name}",
            // Personal data: no copy in the browser or a proxy cache.
            'Cache-Control' => 'no-store, private',
        ]);
    }

    /**
     * The texts and rows of the file, in the Administrator's language.
     *
     * @return array{locale: string, texts: array<string, mixed>, made: string, count: string, rows: list<list<string>>}
     */
    public function pageData(StaffAccount $admin): array
    {
        $locale = $admin->locale === 'en' ? 'en' : 'es';
        $texts = trans('roster_download', [], $locale);
        $athletes = RosterRecord::query()->orderBy('name')->orderBy('id')->get();
        $now = Carbon::now();
        $date = strtr($texts['date'], [
            ':day' => $now->day, ':month' => $texts['months'][$now->month - 1], ':year' => $now->year,
        ]);

        return [
            'locale' => $locale,
            'texts' => $texts,
            'made' => str_replace(':date', $date, $texts['made']),
            'count' => trans_choice('roster_download.count', $athletes->count(), ['count' => $athletes->count()], $locale),
            'rows' => $athletes->map(fn (RosterRecord $athlete) => [
                $athlete->name,
                $athlete->sport,
                $athlete->student_number,
                $athlete->institutional_email,
                $texts['status'][$athlete->removed_at === null ? 'active' : 'withdrawn'],
            ])->values()->all(),
        ];
    }

    /** @param  array<string, mixed>  $data */
    private function word(array $data): string
    {
        // PhpWord writes text as given unless told to escape it; roster text is typed by people.
        Settings::setOutputEscapingEnabled(true);
        $word = new PhpWord;
        $word->getSettings()->setThemeFontLang(new Language($data['locale'] === 'en' ? 'en-US' : 'es-PR'));
        $section = $word->addSection(['orientation' => 'landscape']);
        $section->addTitle($data['texts']['title'], 1);
        $section->addText($data['made'].' '.$data['count']);

        $table = $section->addTable(['borderSize' => 4, 'borderColor' => 'D9DCCB', 'cellMargin' => 60]);
        $table->addRow(null, ['tblHeader' => true]);
        foreach ($data['texts']['columns'] as $column) {
            $table->addCell(2600, ['bgColor' => 'F7F5ED'])->addText($column, ['bold' => true]);
        }
        foreach ($data['rows'] as $row) {
            $table->addRow();
            foreach ($row as $value) {
                $table->addCell(2600)->addText($value);
            }
        }
        $section->addText($data['texts']['private'], ['italic' => true]);

        $path = tempnam(sys_get_temp_dir(), 'roster');
        try {
            IOFactory::createWriter($word, 'Word2007')->save($path);

            return (string) file_get_contents($path);
        } finally {
            @unlink($path);
        }
    }

    /** @param  array<string, mixed>  $data */
    private function pdf(array $data): string
    {
        $options = new Options;
        // Nothing from outside the page and no PHP inside it; Dompdf only lays out our escaped HTML.
        $options->setIsRemoteEnabled(false);
        $options->setIsPhpEnabled(false);
        $options->setIsJavascriptEnabled(false);
        $options->setDefaultFont('DejaVu Sans');
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml(view('roster.download', $data)->render());
        $dompdf->setPaper('letter', 'landscape');
        $dompdf->render();

        return (string) $dompdf->output();
    }
}
