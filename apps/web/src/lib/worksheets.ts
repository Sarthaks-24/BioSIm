/**
 * The printable A4 worksheet of each Teach lesson (X-3; ui-ux §8.3, content-i18n §8.4): the link its
 * QR code opens and which question has the empty axes to sketch on. Its words are `sheet.lessons.<key>`
 * (a text section of its own, loaded with the worksheet: scripts/i18n-sections.mjs).
 *
 * `link` is the lesson's own link without `v=` (like lib/qrPath.ts): a printed page outlives a model
 * version, and a link without one opens on the current model with no "made with an older model" note.
 * Written out readable (`roti:1`, not `roti%3A1`), as a student would type it from the paper.
 * worksheets.test.ts checks each against the lesson's link (lib/lessons.ts, lib/flagship.ts).
 *
 * No imports: the build script reads it to draw one QR code per lesson (scripts/qr-code.mjs).
 */
export interface Sheet {
  link: string
  /** The question (0-based) printed with empty axes, and the hours they span. */
  sketch: { task: number; hours: number }
}

export const SHEETS = {
  flagship: { link: '/sim?a=roti:1,water:1&b=roti:1,water:1&t=51&layer=circulation&act=walk.60.20', sketch: { task: 1, hours: 3 } },
  stomachRace: { link: '/sim?a=cola:1&b=cheeseburger:1,fries:1&t=35', sketch: { task: 1, hours: 6 } },
  rotiDal: { link: '/sim?a=roti:1,dal:1&b=white-rice:1&t=57', sketch: { task: 2, hours: 4 } },
  colaFour: { link: '/sim?a=cola:1&b=cola:4&t=120', sketch: { task: 2, hours: 6 } },
  breathRun: { link: '/sim?a=roti:1&b=roti:1&t=38&layer=breathing&act=run.30.10', sketch: { task: 3, hours: 2 } },
  heartWalk: { link: '/sim?a=roti:1,dal:1&b=roti:1,dal:1&t=70&layer=circulation&act=walk.60.20', sketch: { task: 3, hours: 4 } },
  drinkWater: { link: '/sim?a=water:4&b=water:1&t=60&layer=kidneys', sketch: { task: 0, hours: 4 } },
  fatRoad: { link: '/sim?a=cheeseburger:1,fries:1&b=roti:1&t=240&layer=lymph', sketch: { task: 1, hours: 12 } },
  insulinCola: { link: '/sim?a=cola:1&b=water:1&t=27&layer=hormones', sketch: { task: 0, hours: 4 } },
  musclesRun: { link: '/sim?a=roti:1&b=roti:1&t=38&layer=muscles&act=run.30.10', sketch: { task: 3, hours: 2 } },
  sweatRun: { link: '/sim?a=roti:1&b=roti:1&t=38&layer=skin&act=run.30.10', sketch: { task: 3, hours: 2 } },
} as const satisfies Record<string, Sheet>

export type SheetKey = keyof typeof SHEETS
