import { Player } from '@remotion/player'
import { SubtitleComposition } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import './PreviewPanel.css'

export function PreviewPanel() {
  const jobId = useSubtitleStore((s) => s.jobId)
  const transcript = useSubtitleStore((s) => s.transcript)
  const videoMetadata = useSubtitleStore((s) => s.videoMetadata)
  const style = useSubtitleStore((s) => s.style)

  if (!jobId || !transcript || !videoMetadata) {
    return null
  }

  const durationInFrames = Math.max(1, Math.floor(videoMetadata.duration * videoMetadata.fps))
  const videoSrc = `/api/jobs/${jobId}/video`

  return (
    <div className="preview-panel">
      <Player
        component={SubtitleComposition}
        durationInFrames={durationInFrames}
        compositionWidth={videoMetadata.width}
        compositionHeight={videoMetadata.height}
        fps={videoMetadata.fps}
        controls
        loop
        style={{ width: '100%' }}
        inputProps={{
          videoSrc,
          words: transcript.words,
          style,
        }}
        acknowledgeRemotionLicense
      />
    </div>
  )
}
