# Test evidence

Run on 11/10/2026, 11:19 a. m. (Puerto Rico time), branch `81-test-plan-evidence`, commit `a61ab5a`, with `npm run evidence`, reseeding the database before each browser project. Issue #81; the cases are in `../test-plan.md`.

| Suite | Tests | Passed | Failed | Skipped | Report |
|---|---|---|---|---|---|
| Backend (PHPUnit) | 658 | 657 | 0 | 1 | `results/backend.xml` |
| Unit (Vitest) | 641 | 641 | 0 | 0 | `results/frontend.xml` |
| Browser (Playwright) | 230 | 226 | 0 | 4 | `results/browser-*.xml (6 of 6 projects)` |

## Steps

- Backend tests: passed
- Unit tests (Vitest): passed
- Browser tests (Playwright), chromium: passed
- Browser tests (Playwright), msedge: passed
- Browser tests (Playwright), firefox: passed
- Browser tests (Playwright), webkit: passed
- Browser tests (Playwright), android: passed
- Browser tests (Playwright), iphone: passed
- Demo screenshots: passed

## Demo screenshots

Taken again on 11/10/2026 around 11:40 a. m. on a fresh seed, after each screen loads (#183). The test results above are from the run of #171.

- [01-welcome.png](screenshots/01-welcome.png)
- [02-registro.png](screenshots/02-registro.png)
- [03-iniciar-sesion.png](screenshots/03-iniciar-sesion.png)
- [04-check-in.png](screenshots/04-check-in.png)
- [05-gym-id.png](screenshots/05-gym-id.png)
- [06-gimnasio-ocupacion.png](screenshots/06-gimnasio-ocupacion.png)
- [07-s01-sesiones-activas.png](screenshots/07-s01-sesiones-activas.png)
- [08-s02-persona-y-sesion.png](screenshots/08-s02-persona-y-sesion.png)
- [09-s03-buscar-persona.png](screenshots/09-s03-buscar-persona.png)
- [10-a04-terminos.png](screenshots/10-a04-terminos.png)
- [11-a05-roster.png](screenshots/11-a05-roster.png)
- [12-a15-cuentas-staff.png](screenshots/12-a15-cuentas-staff.png)
