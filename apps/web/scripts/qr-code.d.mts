import type { Plugin } from 'vite'

export const QR_FILE: string
export const SHEET_QR_DIR: string
export function writeSheetQrs(site: string, dir?: string): Promise<void>
export function qrAddress(site: string): string
export function qrSvg(address: string): Promise<string>
export function writeQr(address: string, file?: string): Promise<boolean>
export default function qrCode(options: { site: string }): Plugin
