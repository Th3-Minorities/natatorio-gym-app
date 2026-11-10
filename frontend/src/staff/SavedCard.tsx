import { TermChip } from './team/TermStatus'

/**
 * The confirmation after a change on A-04 and A-05 (term saved, athlete saved, withdrawn, reinstated, roster
 * downloaded): a card with the active term chip and a bold line (Figma 4745:2051, 4745:2101). Render it inside the
 * screen's live region, so screen readers announce it too.
 */
export function SavedCard({ text }: { text: string }) {
  return (
    <section className="saved-card">
      <TermChip />
      <p className="saved-card__title">{text}</p>
    </section>
  )
}
