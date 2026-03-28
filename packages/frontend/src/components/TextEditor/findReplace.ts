import type { SessionPhrase } from '../../lib/grouping.ts'

export interface FindReplaceMatch {
  phraseIndex: number
  phraseText: string     // current phrase text
  replacedText: string   // text after replacement
}

/**
 * Find all phrases containing the search term (case-insensitive substring match).
 * Per D-04: simple text find/replace, no regex support.
 */
export function findMatches(
  phrases: SessionPhrase[],
  findTerm: string,
  replaceTerm: string
): FindReplaceMatch[] {
  if (!findTerm) return []
  const findLower = findTerm.toLowerCase()
  return phrases.reduce<FindReplaceMatch[]>((acc, phrase, i) => {
    const text = phrase.words.map(w => w.word).join(' ')
    if (text.toLowerCase().includes(findLower)) {
      // Case-insensitive replaceAll
      const replacedText = text.replace(new RegExp(escapeRegex(findTerm), 'gi'), replaceTerm)
      acc.push({ phraseIndex: i, phraseText: text, replacedText })
    }
    return acc
  }, [])
}

/**
 * Convert matches into store-ready replacement instructions.
 */
export function applyReplacements(matches: FindReplaceMatch[]): Array<{ phraseIndex: number; newWords: string[] }> {
  return matches.map(m => ({
    phraseIndex: m.phraseIndex,
    newWords: m.replacedText.split(/\s+/).filter(Boolean),
  }))
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
