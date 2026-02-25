import { useState } from 'react'
import { Header } from './components/Header'
import { SubtitlesPage } from './pages/SubtitlesPage'
import './App.css'

const TABS = [
  { id: 'subtitles', label: 'Subtitles' }
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
      </main>
    </div>
  )
}
