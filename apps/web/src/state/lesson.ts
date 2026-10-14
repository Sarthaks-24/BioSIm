import { create } from 'zustand'

/**
 * The guided lesson on the stage (X-1; ui-ux §8.1): which pause it is at, or null with no lesson.
 * Home and Teach start it with their link's history `state` (lib/flagship.ts), which the stage
 * reads when it opens: a link alone never starts it (no new link parameter). The bar itself is lazy (components/LessonBar.tsx, R71,
 * R74): it does the pauses with the stores the body pane hands it, so it shares no module with the stage.
 */
export const useLesson = create<{ step: number | null }>(() => ({ step: null }))
