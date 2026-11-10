import { expect, type Page } from '@playwright/test'

// Mailpit behind the proxy at /mailpit, as docker-compose.yml starts it with the development profile.

/** The newest email Mailpit caught for an address that holds a link to path, as HTML (the plain text part wraps long links). Waits, since an older email can arrive first. */
export async function lastEmailTo(page: Page, address: string, path: string): Promise<string> {
  let text = ''
  await expect(async () => {
    const found = await (await page.request.get(`/mailpit/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=1`)).json()
    expect(found.messages.length).toBeGreaterThan(0)
    const message = await (await page.request.get(`/mailpit/api/v1/message/${found.messages[0].ID}`)).json()
    text = message.HTML
    expect(text).toContain(path)
  }).toPass({ timeout: 60_000 })
  return text
}

export function linkIn(text: string, path: string): string {
  const match = text.match(new RegExp(`https?://[^\\s"<>]+${path}\\?[^\\s"<>]+`))
  if (!match) throw new Error(`No ${path} link in the email`)
  const url = new URL(match[0].replaceAll('&amp;', '&'))
  return url.pathname + url.search
}
