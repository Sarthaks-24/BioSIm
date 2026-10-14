/** The part of qrcode@1.5.4 (a devDependency, Node only) e2e/worksheet.spec.ts uses: the code's modules. */
declare module 'qrcode' {
  interface QRCode {
    modules: { size: number; get(row: number, col: number): number }
  }
  const qrcode: { create(text: string, options: { errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' }): QRCode }
  export default qrcode
}
