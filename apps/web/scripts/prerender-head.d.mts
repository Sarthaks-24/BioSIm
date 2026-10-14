import type { Plugin } from 'vite'

export interface Page {
  route: string
  title: string
  description: string
}
export function routes(en: Record<string, unknown>): Page[]
export function jsonLd(site: string, description: string): string
export function withHead(template: string, head: string): string
export function pageHead(site: string, page: Page): string
export function notFoundHtml(template: string, en: Record<string, unknown>): string
export function sitemap(site: string, pages: Page[], date: string): string
export function robots(site: string): string
export function htmlFile(route: string): string
export default function prerenderHead(options: { site: string }): Plugin
