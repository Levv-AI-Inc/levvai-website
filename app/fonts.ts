import { Archivo, Inter } from 'next/font/google'

/* Inter carries the product UI. Archivo's width axis gives the brand surfaces the stance of the wide-set wordmark. */
export const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const fontDisplay = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['wdth'],
  display: 'swap',
})
