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
}

export function Header({ tabs, activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="header">
      <span className="header__app-name">Eigen Video Editor</span>
      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
    </header>
  )
}
