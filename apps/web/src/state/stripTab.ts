import { create } from 'zustand'

/**
 * Which graph shows when the graphs show one at a time, as tabs (phone, projector, short screen;
 * GraphColumn). Kept outside the column so the clicker and keyboard map can switch it too.
 *
 * TODO(WP-15): the keymap binds S, B and E to `useStripTab.getState().show('gut' | 'blood' |
 * 'energy')` (the slot ids: a signal id's family). An id the lit layer has no graph for is
 * ignored by GraphColumn, which then shows its first graph.
 */
interface StripTabState {
  /** The slot id picked last, or null for "the first graph". */
  tab: string | null
  show: (id: string) => void
}

export const useStripTab = create<StripTabState>((set) => ({
  tab: null,
  show: (tab) => set({ tab }),
}))
