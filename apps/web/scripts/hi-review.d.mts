export const REVIEW_FILE: string
export function flatten(value: unknown, prefix?: string, out?: Map<string, string>): Map<string, string>
export function readTexts(): { en: Map<string, string>; hi: Map<string, string> }
export function syncReview(markdown: string, texts?: { en: Map<string, string>; hi: Map<string, string> }): { markdown: string; problems: string[] }
export function reviewRows(markdown: string): { key: string; en: string; hi: string; status: string }[]
