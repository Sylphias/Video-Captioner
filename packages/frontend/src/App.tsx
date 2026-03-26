import { useState } from 'react'
import { Header } from './components/Header'
import { SubtitlesPage } from './pages/SubtitlesPage'
import { AnimationBuilderPage } from './components/AnimationBuilder/AnimationBuilderPage'
import './App.css'

const TABS = [
  { id: 'subtitles', label: 'Subtitles' },
  { id: 'animation-builder', label: 'Animation Builder' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('subtitles')

  return (
    <div className="app">
      <Header
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="app__main">
        {activeTab === 'subtitles' && <SubtitlesPage />}
        {activeTab === 'animation-builder' && <AnimationBuilderPage />}
      </main>
    </div>
  )
}
