import type { CDPSession, Page } from '@playwright/test'

export const CPU_PATH: string
export function cpuPerFrame(
  page: Page,
  cdp: CDPSession,
  options?: { ms?: number; round?: number },
): Promise<{ main: number; renderer: number; frames: number; ms: number }>
export function median(values: number[]): number
export function ratioGate(base: number, pr: number): { limit: number; ratio: number; pass: boolean }
