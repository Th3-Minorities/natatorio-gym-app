// Chrome fires beforeinstallprompt once per page load, often before N-09 is open, so it is kept from startup.
export type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

type State = { prompt: InstallPrompt | null; installed: boolean }

let state: State = { prompt: null, installed: false }
const listeners = new Set<() => void>()

function set(next: State) {
  state = next
  listeners.forEach((listener) => listener())
}

export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    set({ ...state, prompt: event as InstallPrompt })
  })
  window.addEventListener('appinstalled', () => set({ prompt: null, installed: true }))
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function installState() { return state }

export function promptUsed(installed: boolean) { set({ prompt: null, installed: state.installed || installed }) }

/** Tests only. */
export function resetInstall() { set({ prompt: null, installed: false }) }
