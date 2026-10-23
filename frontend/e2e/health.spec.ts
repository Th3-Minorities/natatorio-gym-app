import { expect, test } from '@playwright/test'

test('page shows the API is connected through the proxy', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('API: conectada')).toBeVisible()
})
