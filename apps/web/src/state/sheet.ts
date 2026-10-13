import { create } from 'zustand'

/**
 * Which of the stage's two lazy sheets is open (WP-15): the graphs as a table ("Show as table",
 * T) or the keys and settings (?, the dock's settings button). A store, so the key map, the
 * strips' buttons and the dock can open them; Stage.tsx draws the open one and downloads its code
 * the first time (size budget). `from` is the button to give focus back to when it closes.
 */
export type Sheet = { kind: 'table'; slot: string | null } | { kind: 'help' } | null

interface SheetState {
  sheet: Sheet
  from: HTMLElement | null
  open: (sheet: NonNullable<Sheet>) => void
  close: () => void
}

export const useSheet = create<SheetState>((set, get) => ({
  sheet: null,
  from: null,
  open: (sheet) => set({ sheet, from: document.activeElement instanceof HTMLElement ? document.activeElement : null }),
  close: () => {
    const from = get().from
    set({ sheet: null, from: null })
    // Back to where the reader was (a native modal does this too, but the sheet is unmounted).
    if (from?.isConnected) from.focus()
  },
}))
