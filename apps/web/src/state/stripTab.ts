import { create } from 'zustand'
import type { SlotId, SystemId } from '../systems/registry.ts'

/**
 * Which graph shows when the graphs show one at a time, as tabs (phone, projector, short screen;
 * GraphColumn). Kept outside the column so the clicker and keyboard map can switch it too.
 *
 * The key map (lib/keys.ts) binds 1–3 to the lit system's slots by place, and S, B and E to
 * digestion's by letter (v3.0). An id the lit system has no graph for is ignored by GraphColumn,
 * which then shows its first graph. Switching systems goes back to the first (state/run.ts setLayer),
 * unless `next` names that system: a lesson that lights a system on one of its graphs (Teach's
 * ready lessons, the flagship's pauses: X-1) says which before the system's pack has arrived.
 */
interface StripTabState {
  /** The slot id picked last, or null for "the first graph". */
  tab: SlotId | null
  /** The graph a system about to be lit opens on (once, when it is lit). */
  next?: { layer: SystemId; slot: SlotId } | null
  show: (id: SlotId) => void
}

export const useStripTab = create<StripTabState>((set) => ({
  tab: null,
  show: (tab) => set({ tab }),
}))
