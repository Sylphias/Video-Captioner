export const SPEAKER_COLORS = [
  '#4A90D9',
  '#E67E22',
  '#27AE60',
  '#9B59B6',
  '#E74C3C',
  '#1ABC9C',
  '#F39C12',
  '#95A5A6',
]

export function getSpeakerColor(speakerId: string): string {
  const idx = parseInt(speakerId.replace('SPEAKER_', ''), 10) % SPEAKER_COLORS.length
  return SPEAKER_COLORS[isNaN(idx) ? 0 : idx]
}
