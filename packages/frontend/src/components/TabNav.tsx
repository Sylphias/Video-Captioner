import './TabNav.css'

interface Tab {
  id: string
  label: string
}

interface TabNavProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
}

export function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="tab-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-nav__tab ${tab.id === activeTab ? 'tab-nav__tab--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          aria-selected={tab.id === activeTab}
          role="tab"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
