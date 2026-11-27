/** Saves a file the browser already holds, with the server's name for it. */
export function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // On the page while it is clicked, as iPhone Safari needs; the URL lives 60 seconds, since revoking it at once can
  // cancel the download there.
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
