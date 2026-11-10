/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { expect, it } from 'vitest'

// #97 security check: no user text is shown as raw HTML. React escapes text by itself, so the only ways to
// show HTML are these. Tests run from frontend/, so src/ is right here.
const RAW_HTML = /dangerouslySetInnerHTML|\.(inner|outer)HTML\s*\+?=|insertAdjacentHTML|document\.write|srcDoc|createContextualFragment|setHTMLUnsafe|parseFromString/

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

it('no source file can show text as raw HTML', () => {
  const files = sourceFiles(join(process.cwd(), 'src'))
  expect(files.length).toBeGreaterThan(10)

  const offenders = files
    .filter((file) => RAW_HTML.test(readFileSync(file, 'utf8')))
    .map((file) => relative(process.cwd(), file))

  expect(offenders).toEqual([])
})
