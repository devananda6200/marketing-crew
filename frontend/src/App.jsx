import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './index.css'

const API_URL = "http://localhost:5000/api"

const SECTION_META = {
  market_research: {
    icon: "🔍",
    label: "Market Research",
    color: "#6366f1",
  },
  strategy: {
    icon: "🎯",
    label: "Strategy",
    color: "#8b5cf6",
  },
  content_calendar: {
    icon: "📅",
    label: "Calendar",
    color: "#06b6d4",
  },
  social_posts: {
    icon: "📱",
    label: "Social",
    color: "#f59e0b",
  },
  blog_draft: {
    icon: "✍️",
    label: "Blog & SEO",
    color: "#10b981",
  },
}

function App() {
  const [view, setView] = useState('INPUT')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('market_research')
  const [expandedSection, setExpandedSection] = useState(null)

  // Edit/Regen state
  const [editingSection, setEditingSection] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [regeneratingSection, setRegeneratingSection] = useState(null)
  const [regenPromptOpen, setRegenPromptOpen] = useState(null)
  const [regenInstructions, setRegenInstructions] = useState('')
  const regenInputRef = useRef(null)

  // Auth state
  const [authStatus, setAuthStatus] = useState({ linkedin: false })
  const [postingStatus, setPostingStatus] = useState({ platform: null, status: null })

  const [formData, setFormData] = useState({
    product_name: "",
    target_audience: "",
    product_description: "",
    budget: ""
  })

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/status`)
      const data = await res.json()
      setAuthStatus(data)
    } catch (err) {
      console.error("Auth check failed:", err)
    }
  }

  const connectPlatform = async (platform) => {
    try {
      const res = await fetch(`${API_URL}/auth/${platform}`)
      const data = await res.json()
      if (data.url) {
        const authWindow = window.open(data.url, '_blank', 'width=600,height=600')
        const timer = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(timer)
            checkAuthStatus()
          }
        }, 1000)
      }
    } catch (err) {
      setError(`Connection failed: ${err.message}`)
    }
  }

  const disconnectPlatform = async (platform) => {
    try {
      const res = await fetch(`${API_URL}/auth/${platform}/disconnect`, { method: 'POST' })
      if (res.ok) checkAuthStatus()
    } catch (err) {
      setError(`Disconnect failed: ${err.message}`)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setError(null)
      setView('LOADING')
      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult(data)
      setActiveTab('market_research')
      setView('RESULTS')
      checkAuthStatus()
    } catch (err) {
      setError(err.message)
      setView('INPUT')
    }
  }

  const handleRegenerate = async (sectionKey) => {
    try {
      setRegeneratingSection(sectionKey)
      setRegenPromptOpen(null)
      const res = await fetch(`${API_URL}/regenerate-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key: sectionKey,
          current_content: result.sections[sectionKey],
          instructions: regenInstructions,
          product_name: formData.product_name,
          target_audience: formData.target_audience,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(prev => ({
        ...prev,
        sections: { ...prev.sections, [sectionKey]: data.new_content }
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setRegeneratingSection(null)
    }
  }

  const postToLinkedIn = async () => {
    try {
      setPostingStatus({ platform: 'linkedin', status: 'posting' })
      const res = await fetch(`${API_URL}/post/linkedin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: result.sections.social_posts })
      })
      if (!res.ok) throw new Error('Posting failed')
      setPostingStatus({ platform: 'linkedin', status: 'success' })
      setTimeout(() => setPostingStatus({ platform: null, status: null }), 3000)
    } catch (err) {
      setError(err.message)
      setPostingStatus({ platform: 'linkedin', status: 'error' })
    }
  }

  const renderSectionContent = (sectionKey) => {
    const isEditing = editingSection === sectionKey
    const isRegenerating = regeneratingSection === sectionKey
    const content = result.sections[sectionKey]

    return (
      <div className="section-body">
        <div className="section-actions">
          {!isEditing && !isRegenerating && (
            <>
              <button className="action-btn" onClick={() => {setEditingSection(sectionKey); setEditContent(content);}}>
                <span>✏️</span> Edit
              </button>
              <button className="action-btn" onClick={() => setRegenPromptOpen(sectionKey)}>
                <span>🔄</span> Improve with AI
              </button>
              {sectionKey === 'social_posts' && authStatus.linkedin && (
                <button className="action-btn action-linkedin" onClick={postToLinkedIn} disabled={postingStatus.status === 'posting'}>
                  <span>🔗</span> {postingStatus.status === 'posting' ? 'Posting...' : 'Post to LinkedIn'}
                </button>
              )}
            </>
          )}
        </div>

        {postingStatus.status === 'success' && sectionKey === 'social_posts' && (
          <div className="post-success animate-in">✅ Successfully published to LinkedIn!</div>
        )}

        {regenPromptOpen === sectionKey && (
          <div className="regen-prompt animate-in">
            <textarea 
              ref={regenInputRef} 
              className="regen-input" 
              placeholder="What should we improve? (e.g. 'Make it more professional', 'Add data points')"
              value={regenInstructions}
              onChange={(e) => setRegenInstructions(e.target.value)}
            />
            <div className="regen-actions">
              <button className="btn-primary" style={{marginTop: 0, width: 'auto'}} onClick={() => handleRegenerate(sectionKey)}>⚡ Regenerate</button>
              <button className="btn-secondary" onClick={() => setRegenPromptOpen(null)}>Cancel</button>
            </div>
          </div>
        )}

        {isRegenerating && <div className="regen-loading"><div className="pulse-ring" style={{width: 40, height: 40}}></div> Improving...</div>}

        {isEditing ? (
          <div className="edit-mode animate-in">
            <textarea className="edit-textarea" value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={15} />
            <div className="edit-actions" style={{marginTop: '1rem', display: 'flex', gap: '0.5rem'}}>
              <button className="btn-primary" style={{marginTop: 0, width: 'auto'}} onClick={() => {
                setResult(prev => ({...prev, sections: {...prev.sections, [sectionKey]: editContent}}));
                setEditingSection(null);
              }}>Save</button>
              <button className="btn-secondary" onClick={() => setEditingSection(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          !isRegenerating && (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '_No content generated._'}</ReactMarkdown>
              {sectionKey === 'social_posts' && (
                <div className="draft-info-box">
                  <p>🚀 <strong>Note:</strong> LinkedIn is connected for direct posting. X and Instagram posts below are drafts ready for you to copy and paste!</p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      <header className="app-header">
        <div className="logo-mark">MC2</div>
        <div>
          <h1 className="app-title">Marketing Crew 2</h1>
          <p className="app-subtitle">The Professional AI Marketing Engine</p>
        </div>
      </header>

      {view === 'INPUT' && (
        <div className="input-view animate-in">
          <div className="hero-section">
            <h2 className="hero-title">Elevate Your Brand with AI Precision</h2>
            <p className="hero-desc">Generate a comprehensive marketing strategy, content calendar, and optimized posts in one seamless workflow.</p>
          </div>

          <form onSubmit={handleSubmit} className="input-form glass-card">
            <div className="form-grid">
              <div className="form-group">
                <label>Product Name</label>
                <input value={formData.product_name} onChange={e => setFormData({...formData, product_name: e.target.value})} placeholder="e.g. Nexus AI Automation" required />
              </div>
              <div className="form-group">
                <label>Target Audience</label>
                <input value={formData.target_audience} onChange={e => setFormData({...formData, target_audience: e.target.value})} placeholder="e.g. Small Business Owners" required />
              </div>
              <div className="form-group full-width">
                <label>Product Description</label>
                <textarea value={formData.product_description} onChange={e => setFormData({...formData, product_description: e.target.value})} rows={3} placeholder="e.g. An AI tool that automates repetitive Excel tasks to save 10+ hours a week." required />
              </div>
              <div className="form-group">
                <label>Monthly Budget</label>
                <input value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})} placeholder="e.g. Rs. 20,000" required />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              <span className="btn-icon">⚡</span> Generate Campaign
            </button>
          </form>

          <div className="feature-pills">
            {Object.values(SECTION_META).map((s, i) => (
              <span key={i} className="pill">{s.icon} {s.label}</span>
            ))}
          </div>
        </div>
      )}

      {view === 'LOADING' && (
        <div className="loading-view animate-in">
          <div className="glass-card loader-card">
            <div className="pulse-ring"></div>
            <h2 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>Analyzing & Strategizing</h2>
            <p style={{color: 'var(--text-muted)'}}>Our AI crew is architecting your marketing package...</p>
          </div>
        </div>
      )}

      {view === 'RESULTS' && result && (
        <div className="results-view animate-in">
          <div className="results-header">
            <div>
              <h2 className="results-title">Marketing Strategy Ready</h2>
              <p className="results-meta">Engineered for <strong>{formData.product_name}</strong> using {result.model}</p>
            </div>
            <button onClick={() => setView('INPUT')} className="btn-secondary">+ New Strategy</button>
          </div>

          <div className="platform-connections">
            <div className={`platform-card ${authStatus.linkedin ? 'connected' : ''}`}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                <span style={{fontSize: '1.5rem'}}>🔗</span>
                <div>
                  <div style={{fontWeight: 600}}>LinkedIn Integration</div>
                  <div style={{fontSize: '0.8rem', opacity: 0.7}}>{authStatus.linkedin ? 'Direct Posting Active' : 'Connect to Post Directly'}</div>
                </div>
              </div>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button className={`btn-connect ${authStatus.linkedin ? 'btn-connected' : ''}`} onClick={() => !authStatus.linkedin && connectPlatform('linkedin')}>
                  {authStatus.linkedin ? 'Linked ✓' : 'Connect'}
                </button>
                {authStatus.linkedin && (
                  <button className="btn-secondary" style={{padding: '0.5rem 1rem', fontSize: '0.8rem'}} onClick={() => disconnectPlatform('linkedin')}>
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>

          <nav className="tab-nav">
            {Object.entries(SECTION_META).map(([key, meta]) => (
              <button key={key} className={`tab-btn ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
                <span>{meta.icon}</span> <span className="tab-label">{meta.label}</span>
              </button>
            ))}
          </nav>

          <div className="tab-content glass-card">
            <div className="section-header">
              <span className="section-icon">{SECTION_META[activeTab].icon}</span>
              <h3 style={{fontSize: '1.5rem'}}>{SECTION_META[activeTab].label}</h3>
            </div>
            {renderSectionContent(activeTab)}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
