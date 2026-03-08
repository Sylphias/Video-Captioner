export type StageId = 'text' | 'timing' | 'speakers' | 'styling'

interface Stage {
  id: StageId
  label: string
}

const STAGES: Stage[] = [
  { id: 'text', label: 'Text' },
  { id: 'timing', label: 'Timing' },
  { id: 'speakers', label: 'Speakers' },
  { id: 'styling', label: 'Styling' },
]

interface StageTabBarProps {
  activeStage: StageId
  onStageChange: (stage: StageId) => void
}

export function StageTabBar({ activeStage, onStageChange }: StageTabBarProps) {
  const activeIndex = STAGES.findIndex((s) => s.id === activeStage)

  return (
    <div className="stage-tab-bar">
      {STAGES.map((stage, index) => {
        const isActive = stage.id === activeStage
        // Suggested next: the stage immediately after the active one
        const isSuggested = index === activeIndex + 1

        let className = 'stage-tab-bar__tab'
        if (isActive) className += ' stage-tab-bar__tab--active'
        else if (isSuggested) className += ' stage-tab-bar__tab--suggested'

        return (
          <button
            key={stage.id}
            className={className}
            onClick={() => onStageChange(stage.id)}
            type="button"
          >
            {stage.label}
            {isSuggested && <span className="stage-tab-bar__dot" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
