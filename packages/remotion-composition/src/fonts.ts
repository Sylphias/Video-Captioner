import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto'
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald'
import { loadFont as loadLato } from '@remotion/google-fonts/Lato'
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins'
import { loadFont as loadNotoSans } from '@remotion/google-fonts/NotoSans'
import { loadFont as loadPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay'

// Module-level font loading — side effects fire when this module is imported.
// Remotion's loadFont() registers fonts with delayRender/continueRender internally.
const FONTS = {
  Inter: loadInter('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Roboto: loadRoboto('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Montserrat: loadMontserrat('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Oswald: loadOswald('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Lato: loadLato('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Poppins: loadPoppins('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  NotoSans: loadNotoSans('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  PlayfairDisplay: loadPlayfairDisplay('normal', { weights: ['400', '700'], subsets: ['latin'] }),
} as const

export { FONTS }

export type FontName = keyof typeof FONTS

export const FONT_NAMES: FontName[] = Object.keys(FONTS) as FontName[]

export function getFontFamily(name: FontName): string {
  return FONTS[name].fontFamily
}
