import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './index.css'

const rawApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_HOST ? `https://${import.meta.env.VITE_API_HOST}` : "http://localhost:5000/api")
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`

const SECTION_META = {
  market_research: {
    label: "Market Research",
  },
  strategy: {
    label: "Marketing Strategy",
  },
  content_calendar: {
    label: "Content Calendar",
  },
  social_posts: {
    label: "Social Media",
  },
  blog_draft: {
    label: "Blog & SEO",
  },
}

function App() {
  const [view, setView] = useState('INPUT')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('market_research')
  const [isPrinting, setIsPrinting] = useState(false)

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

  const handleDownloadPDF = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 500)
  }

  const renderSectionContent = (sectionKey) => {
    const isEditing = editingSection === sectionKey
    const isRegenerating = regeneratingSection === sectionKey
    const content = result.sections[sectionKey]

    return (
      <div className="section-body">
        <div className="section-actions no-print">
          {!isEditing && !isRegenerating && (
            <>
              <button className="action-btn" onClick={() => {setEditingSection(sectionKey); setEditContent(content);}}>Edit</button>
              <button className="action-btn" onClick={() => setRegenPromptOpen(sectionKey)}>Improve with AI</button>
              {sectionKey === 'social_posts' && authStatus.linkedin && (
                <button className="action-btn" style={{background: '#0a66c2', borderColor: '#0a66c2'}} onClick={postToLinkedIn} disabled={postingStatus.status === 'posting'}>
                  {postingStatus.status === 'posting' ? 'Publishing...' : 'Publish to LinkedIn'}
                </button>
              )}
            </>
          )}
        </div>

        {postingStatus.status === 'success' && sectionKey === 'social_posts' && (
          <div className="no-print" style={{color: 'var(--success)', marginBottom: '1rem', fontSize: '0.875rem'}}>Published successfully to LinkedIn.</div>
        )}

        {regenPromptOpen === sectionKey && (
          <div className="no-print" style={{marginBottom: '1.5rem'}}>
            <textarea 
              ref={regenInputRef} 
              style={{width: '100%', marginBottom: '0.5rem', minHeight: '80px'}}
              placeholder="Refinement instructions (e.g. 'More technical tone')"
              value={regenInstructions}
              onChange={(e) => setRegenInstructions(e.target.value)}
            />
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button className="btn-primary" style={{marginTop: 0}} onClick={() => handleRegenerate(sectionKey)}>Regenerate</button>
              <button className="btn-secondary" onClick={() => setRegenPromptOpen(null)}>Cancel</button>
            </div>
          </div>
        )}

        {isRegenerating && <div className="no-print" style={{padding: '2rem 0', color: 'var(--text-muted)'}}>Regenerating section...</div>}

        {isEditing ? (
          <div className="no-print">
            <textarea style={{width: '100%', minHeight: '300px', marginBottom: '1rem'}} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button className="btn-primary" style={{marginTop: 0}} onClick={() => {
                setResult(prev => ({...prev, sections: {...prev.sections, [sectionKey]: editContent}}));
                setEditingSection(null);
              }}>Save Changes</button>
              <button className="btn-secondary" onClick={() => setEditingSection(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          !isRegenerating && (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || 'No content generated.'}</ReactMarkdown>
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div className={`app ${isPrinting ? 'printing-all' : ''}`}>
      <header className="app-header no-print">
        <div className="logo-mark">MC</div>
        <div>
          <h1 className="app-title">Marketing Crew</h1>
          <p className="app-subtitle">Enterprise AI Marketing Engine</p>
        </div>
      </header>

      {view === 'INPUT' && (
        <div className="input-view no-print">
          <div className="hero-section">
            <h2 className="hero-title">Marketing Campaign Generator</h2>
            <p className="hero-desc">Generate market research, strategy, and social content for your product using specialized AI agents.</p>
          </div>

          <form onSubmit={handleSubmit} className="input-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Product Name</label>
                <input value={formData.product_name} onChange={e => setFormData({...formData, product_name: e.target.value})} placeholder="e.g. Nexus AI" required />
              </div>
              <div className="form-group">
                <label>Target Audience</label>
                <input value={formData.target_audience} onChange={e => setFormData({...formData, target_audience: e.target.value})} placeholder="e.g. Small Business Owners" required />
              </div>
              <div className="form-group full-width">
                <label>Product Description</label>
                <textarea value={formData.product_description} onChange={e => setFormData({...formData, product_description: e.target.value})} rows={2} placeholder="Describe the problem your product solves..." required />
              </div>
              <div className="form-group">
                <label>Monthly Budget</label>
                <input value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})} placeholder="e.g. Rs. 20,000" required />
              </div>
            </div>
            <button type="submit" className="btn-primary">Generate Marketing Package</button>
          </form>
        </div>
      )}

      {view === 'LOADING' && (
        <div className="loader-container no-print">
          <div className="spinner"></div>
          <p style={{marginTop: '1.5rem', fontWeight: 500}}>Generating marketing assets...</p>
        </div>
      )}

      {view === 'RESULTS' && result && (
        <div className="results-view">
          <div className="results-header no-print">
            <div>
              <h2 className="results-title">Campaign Results</h2>
              <p className="results-meta">Product: {formData.product_name} | Model: {result.model}</p>
            </div>
            <div style={{display: 'flex', gap: '0.75rem'}}>
              <button onClick={handleDownloadPDF} className="btn-primary" style={{marginTop: 0}}>Download Full Strategy (PDF)</button>
              <button onClick={() => setView('INPUT')} className="btn-secondary">New Campaign</button>
            </div>
          </div>

          <div className="platform-card no-print">
            <div>
              <div style={{fontWeight: 600, fontSize: '0.9375rem'}}>LinkedIn Integration</div>
              <div style={{fontSize: '0.8125rem', color: 'var(--text-muted)'}}>{authStatus.linkedin ? 'Account linked' : 'Not connected'}</div>
            </div>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button className={`btn-connect ${authStatus.linkedin ? 'btn-connected' : ''}`} onClick={() => !authStatus.linkedin && connectPlatform('linkedin')}>
                {authStatus.linkedin ? 'Linked' : 'Connect'}
              </button>
              {authStatus.linkedin && (
                <button className="btn-secondary" style={{padding: '0.4rem 0.8rem', fontSize: '0.75rem'}} onClick={() => disconnectPlatform('linkedin')}>Disconnect</button>
              )}
            </div>
          </div>

          <nav className="tab-nav no-print">
            {Object.entries(SECTION_META).map(([key, meta]) => (
              <button key={key} className={`tab-btn ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
                {meta.label}
              </button>
            ))}
          </nav>

          {isPrinting ? (
            <div className="print-only">
              <h1 style={{textAlign: 'center', marginBottom: '2rem'}}>Full Marketing Strategy: {formData.product_name}</h1>
              {Object.entries(SECTION_META).map(([key, meta]) => (
                <div key={key} style={{marginBottom: '3rem'}}>
                  <h2 style={{borderBottom: '2px solid black', paddingBottom: '0.5rem', marginBottom: '1rem'}}>{meta.label}</h2>
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.sections[key] || ''}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="tab-content-card">
              <div className="section-header no-print">
                <h3 className="section-title">{SECTION_META[activeTab].label}</h3>
              </div>
              {renderSectionContent(activeTab)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
