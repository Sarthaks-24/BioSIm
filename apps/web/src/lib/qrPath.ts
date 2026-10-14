/**
 * Where the Teach page's QR code goes (council round 3): the screen questions 1 to 3 start from,
 * cola alone at 0 min (presets.test.ts checks it against TASKS). The QR picture is made from it at
 * build time, with the site address (VITE_SITE_URL) in front (scripts/qr-code.mjs, R79). A file of
 * its own with no imports, so the build script can read it.
 */
export const QR_PATH = '/sim?v=2&a=cola:1'
