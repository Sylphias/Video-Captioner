import { useState } from 'react'
import { Header } from './components/Header'
import { SubtitlesPage } from './pages/SubtitlesPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { AnimationBuilderPage } from './components/AnimationBuilder/AnimationBuilderPage'
import './App.css'

const TABS = [
  { id: 'projects', label: 'Projects' },
  { id: 'animation-builder', label: 'Animation Builder' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('projects')
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  const handleOpenProject = (projectId: string) => {
    setActiveProjectId(projectId)
    // Stay on projects tab — editing view renders within it
  }

  const handleBackToList = () => {
    setActiveProjectId(null)
  }

  const handleTabChange = (tab: string) => {
    if (tab === 'projects') {
      setActiveProjectId(null) // D-09: back to list
    }
    setActiveTab(tab)
  }

  return (
    <div className="app">
      <Header tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="app__main">
        {activeTab === 'projects' && !activeProjectId && (
          <ProjectsPage onOpenProject={handleOpenProject} />
        )}
        {activeTab === 'projects' && activeProjectId && (
          <SubtitlesPage
            projectId={activeProjectId}
            onBack={handleBackToList}
          />
        )}
        {activeTab === 'animation-builder' && <AnimationBuilderPage />}
      </main>
    </div>
  )
}
