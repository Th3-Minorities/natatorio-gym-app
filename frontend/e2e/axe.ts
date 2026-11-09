import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// #82: WCAG 2.0, 2.1 and 2.2 levels A and AA. CI uploads RESULTS (see .github/workflows/frontend.yml).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const RESULTS = fileURLToPath(new URL('../a11y-results', import.meta.url))
const scans = new Map<string, number>()

/** Scans the page, saves the result as JSON and fails the test on any violation. */
export async function expectNoViolations(page: Page) {
  const info = test.info()
  const { url: scanned, violations, incomplete, passes } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const address = new URL(scanned)
  const url = address.origin + address.pathname
  const count = (scans.get(info.testId) ?? 0) + 1
  scans.set(info.testId, count)
  const name = `${info.titlePath.slice(1).join(' ').replace(/[^a-z0-9]+/gi, '-').slice(0, 120)}-${count}.json`
  const folder = join(RESULTS, info.project.name)
  await mkdir(folder, { recursive: true })
  const passed = passes.map((rule) => rule.id)
  await writeFile(join(folder, name), JSON.stringify({ test: info.titlePath.slice(1).join(' > '), url, tags: TAGS, violations, incomplete, passed }, null, 2))
  expect(violations).toEqual([])
}
