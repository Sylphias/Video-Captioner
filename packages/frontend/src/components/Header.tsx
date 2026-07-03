import { TabNav } from './TabNav'
import './Header.css'

interface Tab {
  id: string
  label: string
}

interface HeaderProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  /** Clicking the app title navigates back to the projects (landing) page. */
  onTitleClick?: () => void
}

export function Header({ tabs, activeTab, onTabChange, onTitleClick }: HeaderProps) {
  return (
    <header className="header">
      <button
        type="button"
        className="header__app-name"
        onClick={onTitleClick}
        title="Back to projects"
      >
        Eigen Video Editor
      </button>
      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
    </header>
  )
}
