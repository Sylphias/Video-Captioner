import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto'
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald'
import { loadFont as loadLato } from '@remotion/google-fonts/Lato'
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins'
import { loadFont as loadNotoSans } from '@remotion/google-fonts/NotoSans'
import { loadFont as loadPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue'
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton'
import { loadFont as loadBangers } from '@remotion/google-fonts/Bangers'
import { loadFont as loadBlackOpsOne } from '@remotion/google-fonts/BlackOpsOne'
import { loadFont as loadTeko } from '@remotion/google-fonts/Teko'
import { loadFont as loadRubik } from '@remotion/google-fonts/Rubik'
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito'
import { loadFont as loadKanit } from '@remotion/google-fonts/Kanit'
import { loadFont as loadRighteous } from '@remotion/google-fonts/Righteous'
import { loadFont as loadPermanentMarker } from '@remotion/google-fonts/PermanentMarker'
import { loadFont as loadPassionOne } from '@remotion/google-fonts/PassionOne'
import { loadFont as loadRussoOne } from '@remotion/google-fonts/RussoOne'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { loadFont as loadBarlowCondensed } from '@remotion/google-fonts/BarlowCondensed'
import { loadFont as loadOutfit } from '@remotion/google-fonts/Outfit'
import { loadFont as loadStaatliches } from '@remotion/google-fonts/Staatliches'
import { loadFont as loadLuckiestGuy } from '@remotion/google-fonts/LuckiestGuy'
import { loadFont as loadLilitaOne } from '@remotion/google-fonts/LilitaOne'

// Module-level font loading — side effects fire when this module is imported.
// Remotion's loadFont() registers fonts with delayRender/continueRender internally.
// Each font specifies its own supported weights to satisfy strict TS types.
const FONTS = {
  // Sans-serif (variable weight)
  Inter: loadInter('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
  Roboto: loadRoboto('normal', { weights: ['300', '400', '500', '700', '900'], subsets: ['latin'] }),
  Montserrat: loadMontserrat('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
  Poppins: loadPoppins('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
  Nunito: loadNunito('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
  Rubik: loadRubik('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
  Outfit: loadOutfit('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
  NotoSans: loadNotoSans('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
  Lato: loadLato('normal', { weights: ['300', '400', '700', '900'], subsets: ['latin'] }),
  Kanit: loadKanit('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
  // Condensed / narrow
  Oswald: loadOswald('normal', { weights: ['300', '400', '500', '600', '700'], subsets: ['latin'] }),
  Teko: loadTeko('normal', { weights: ['300', '400', '500', '600', '700'], subsets: ['latin'] }),
  BarlowCondensed: loadBarlowCondensed('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
  // Display / impact (single weight — inherently bold)
  LilitaOne: loadLilitaOne('normal', { weights: ['400'], subsets: ['latin'] }),
  BebasNeue: loadBebasNeue('normal', { weights: ['400'], subsets: ['latin'] }),
  Anton: loadAnton('normal', { weights: ['400'], subsets: ['latin'] }),
  Bangers: loadBangers('normal', { weights: ['400'], subsets: ['latin'] }),
  BlackOpsOne: loadBlackOpsOne('normal', { weights: ['400'], subsets: ['latin'] }),
  ArchivoBlack: loadArchivoBlack('normal', { weights: ['400'], subsets: ['latin'] }),
  Staatliches: loadStaatliches('normal', { weights: ['400'], subsets: ['latin'] }),
  Righteous: loadRighteous('normal', { weights: ['400'], subsets: ['latin'] }),
  PassionOne: loadPassionOne('normal', { weights: ['400', '700', '900'], subsets: ['latin'] }),
  RussoOne: loadRussoOne('normal', { weights: ['400'], subsets: ['latin'] }),
  LuckiestGuy: loadLuckiestGuy('normal', { weights: ['400'], subsets: ['latin'] }),
  // Handwritten / marker
  PermanentMarker: loadPermanentMarker('normal', { weights: ['400'], subsets: ['latin'] }),
  // Serif
  PlayfairDisplay: loadPlayfairDisplay('normal', { weights: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'] }),
} as const

export { FONTS }

export type FontName = keyof typeof FONTS

export const FONT_NAMES: FontName[] = Object.keys(FONTS) as FontName[]

export function getFontFamily(name: FontName): string {
  return FONTS[name].fontFamily
}

/** Font weight options with human-readable labels. */
export const FONT_WEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semi Bold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra Bold' },
  { value: 900, label: 'Black' },
]
