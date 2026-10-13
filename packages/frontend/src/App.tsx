import { useState } from 'react'
import { Header } from './components/Header'
import { SubtitlesPage } from './pages/SubtitlesPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { AnimationBuilderPage } from './components/AnimationBuilder/AnimationBuilderPage'
import { StyleStudioPage } from './components/StyleStudio/StyleStudioPage'
import { FirstRunSetup } from './components/FirstRunSetup'
import { useSetup } from './hooks/useSetup'
import './App.css'

const TABS = [
  { id: 'projects', label: 'Projects' },
  { id: 'animation-builder', label: 'Animation Builder' },
  { id: 'style-studio', label: 'Style Studio' },
]

export default function App() {
  const setup = useSetup()
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

  // App title → projects landing page. Same (guard-free) pattern as clicking
  // the Projects tab while editing: auto-save covers unsaved work, so no
  // confirm dialog exists anywhere for navigating away from the editor.
  const handleTitleClick = () => {
    setActiveProjectId(null)
    setActiveTab('projects')
  }

  // First-run gate (D-08): nothing works without the Python venv, so the setup screen
  // replaces the whole app until the environment is ready.
  if (setup.status === 'checking') {
    return <div className="app" />
  }
  if (setup.status !== 'ready') {
    return (
      <div className="app">
        <FirstRunSetup
          status={setup.status}
          progress={setup.progress}
          phaseLabel={setup.phaseLabel}
          error={setup.error}
          onStart={() => void setup.startSetup()}
          onCancel={() => void setup.cancelSetup()}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <Header tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} onTitleClick={handleTitleClick} />
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
        {activeTab === 'style-studio' && <StyleStudioPage />}
      </main>
    </div>
  )
}
