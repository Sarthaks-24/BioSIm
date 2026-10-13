import type { Plugin } from 'vite'

export const PAGE_SECTIONS: Record<string, string[]>
export const ENGLISH_ONLY: Record<string, string>
export function englishFor<T extends Record<string, unknown>>(en: T, hindi: boolean): T
export function coreText(en: Record<string, unknown>): Record<string, unknown>
export default function i18nSections(): Plugin
