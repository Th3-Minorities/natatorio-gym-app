import { describe, expect, it } from 'vitest'
import tokens from './tokens.css?raw'

// The design values of the Figma file MOCKUPS-GYM (variables of the dashboard shell, node 98:5).

function token(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`tokens.css has no --${name}`)
  const value = match[1].trim()
  const reference = value.match(/^var\(--([\w-]+)\)$/)
  return reference ? token(reference[1]) : value
}

// WCAG 2.2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('design tokens', () => {
  it('match the Figma colors', () => {
    expect({
      background: token('background'),
      surface: token('surface'),
      foreground: token('foreground'),
      'muted-foreground': token('muted-foreground'),
      border: token('border'),
      primary: token('primary'),
      'primary-foreground': token('primary-foreground'),
      hero: token('hero'),
      accent: token('accent'),
      sage: token('sage'),
    }).toEqual({
      background: '#f7f5ed',
      surface: '#fffdf8',
      foreground: '#25291e',
      'muted-foreground': '#616653',
      border: '#d9dccb',
      primary: '#337137',
      'primary-foreground': '#ffffff',
      hero: '#204e2a',
      accent: '#fa9500',
      sage: '#babd8d',
    })
  })

  it('uses the User palette for fields without changing shared input borders', () => {
    expect(token('user-field-background')).toBe('#fffdf8')
    expect(token('user-border-input')).toBe('#d9dccb')
    expect(token('border-input')).toBe('#8a8e7c')
  })

  it('match the Figma spacing and font', () => {
    expect([4, 8, 12, 16, 20, 24, 32].map((n) => token(`spacing-${n}`))).toEqual(
      ['4px', '8px', '12px', '16px', '20px', '24px', '32px'],
    )
    expect(token('font-sans')).toMatch(/^'Inter'/)
  })

  // Text needs 4.5:1 (WCAG 1.4.3). Icons and other non-text need 3:1 (WCAG 1.4.11).
  it.each([
    ['User offline banner text', 'foreground', 'user-sage-soft', 4.5],
    ['User placeholder and loading icons', 'primary', 'user-sage-soft', 3],
    ['User destructive button text', 'primary-foreground', 'user-danger', 4.5],
    ['User password field errors', 'user-danger', 'surface', 4.5],
    ['User filled input text', 'user-field-text', 'user-field-background', 4.5],
    ['User reset field errors', 'user-field-error', 'surface', 4.5],
    ['User reset error borders', 'user-field-error', 'user-field-background', 3],
    ['Check In member buttons', 'surface', 'check-in-member', 4.5],
    ['Check In athlete buttons', 'surface', 'primary', 4.5],
    ['Check In notices and the exclusive panel', 'hero', 'check-in-gold-soft', 4.5],
    ['Check In refusal panels', 'foreground', 'check-in-danger-soft', 4.5],
    ['Check In refusal icons and offline banner', 'user-danger', 'check-in-danger-soft', 4.5],
    ['Check In closed panel', 'foreground', 'background', 4.5],
    ['Check In member ID text', 'surface', 'check-in-member', 4.5],
    ['Check In athlete ID text', 'surface', 'check-in-athlete-card', 4.5],
    ['Check In member page text', 'surface', 'check-in-member-background', 4.5],
    ['Check In athlete page text', 'surface', 'check-in-athlete-background', 4.5],
    ['Check In member category pill', 'check-in-member', 'surface', 4.5],
    ['text on the page', 'foreground', 'background', 4.5],
    ['text on a card', 'foreground', 'surface', 4.5],
    ['muted text on the page', 'muted-foreground', 'background', 4.5],
    ['muted text on a card', 'muted-foreground', 'surface', 4.5],
    ['button text on the primary green', 'primary-foreground', 'primary', 4.5],
    ['sidebar text on the dark green', 'primary-foreground', 'hero', 4.5],
    ['sidebar section labels', 'sage', 'hero', 4.5],
    ['Administration items on their own background', 'primary-foreground', 'hero-raised', 4.5],
    ['the Administration label on its own background', 'sage-on-raised', 'hero-raised', 4.5],
    ['links on a card', 'primary', 'surface', 4.5],
    ['orange icons and marks in the sidebar', 'accent', 'hero', 3],
    ['the open menu item', 'hero', 'border', 4.5],
    ['the "Invitado" chip', 'chip-invited-foreground', 'chip-invited', 4.5],
    ['the "Desactivado" chip', 'muted-foreground', 'chip-off', 4.5],
    // A field's border shows where to type, so it needs 3:1 against its inside and the page (WCAG 1.4.11).
    ['text field borders against the field', 'border-input', 'surface', 3],
    ['text field borders against the page', 'border-input', 'background', 3],
  ])('%s meet WCAG AA contrast', (_, text, back, minimum) => {
    expect(contrast(token(text), token(back))).toBeGreaterThanOrEqual(minimum)
  })
})
