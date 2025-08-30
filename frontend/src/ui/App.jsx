import Player from './Player'
import AutoMatch from './AutoMatch'
import { getFile, putFile } from './player-utils'
import React, { useEffect, useState, useMemo } from 'react'
import { openDB } from 'idb'

const dbPromise = openDB('offline-audio', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('files')) {
      const store = db.createObjectStore('files', { keyPath: 'trackId' })
      store.createIndex('by-track', 'trackId')
    }
  }
})

function useAuth() {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(setMe)
      .finally(() => setLoading(false))
  }, [])
  return { me, loading }
}

export default function App() {
  const { me, loading } = useAuth()
  const [playlists, setPlaylists] = useState([])
  const [selected, setSelected] = useState(null)
  const [tracks, setTracks] = useState([])
  const [now, setNow] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)

  useEffect(() => {
    if (!loading && !me) {
      // Not logged in
    } else if (me) {
      fetch('/api/playlists', { credentials: 'include' })
        .then(r => r.json())
        .then(setPlaylists)
    }
  }, [me, loading])

  useEffect(() => {
    if (selected) {
      fetch(`/api/playlist/${selected.id}/tracks`, { credentials: 'include' })
        .then(r => r.json())
        .then(setTracks)
    } else {
      setTracks([])
    }
  }, [selected])

  async function onAttachLocal(t) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (file) {
        await putFile(t.id, file)
        alert('Saved for offline ✓')
      }
    }
    input.click()
  }

  async function onPlay(t) {
    const blob = await getFile(t.id)
    if (!blob) {
      alert('No local file attached for this track yet. Click "Attach audio".')
      return
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    const url = URL.createObjectURL(blob)
    setAudioUrl(url)
    setNow(t)
    const audio = document.getElementById('player')
    audio.src = url
    audio.play()
  }

  function Login() {
    const handle = async () => {
      const res = await fetch('/api/login', { credentials: 'include' })
      const { url } = await res.json()
      window.location.href = url
    }
    return (
      <div style={{display:'grid',placeItems:'center',minHeight:'100vh'}}>
        <div style={{maxWidth:560, padding:24, border:'1px solid #eee', borderRadius:12}}>
          <h1>Offline Player</h1>
          <p>Connect to Spotify to import your playlist names and tracks (metadata only).</p>
          <button onClick={handle} style={{padding:'12px 16px', borderRadius:8}}>Log in with Spotify</button>
          <p style={{marginTop:12, fontSize:12, opacity:.7}}>
            This app never downloads Spotify audio. You attach your own files for offline playback.
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <div style={{padding:24}}>Loading…</div>
  if (!me) return <Login />

  return (
    <div style={{display:'grid', gridTemplateColumns:'280px 1fr', minHeight:'100vh'}}>
      <aside style={{borderRight:'1px solid #eee', padding:16}}>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          {me.images?.[0]?.url && <img src={me.images[0].url} width="36" height="36" style={{borderRadius:'50%'}}/>}
          <div>
            <div style={{fontWeight:600}}>{me.display_name || me.id}</div>
            <div style={{fontSize:12, opacity:.7}}>{me.email}</div>
          </div>
        </div>
        <h3 style={{marginTop:16}}>Playlists</h3>
        <div style={{display:'grid', gap:6, maxHeight:'70vh', overflow:'auto'}}>
          {playlists.map(p => (
            <button key={p.id} onClick={() => setSelected(p)} style={{textAlign:'left', padding:'8px 10px', borderRadius:8, border: selected?.id===p.id ? '2px solid #000' : '1px solid #ddd'}}>
              {p.name}
            </button>
          ))}
        </div>
      </aside>
      <main style={{padding:16}}>
        {selected ? <>
          <h2>{selected.name}</h2>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', borderBottom:'1px solid #eee', padding:'6px'}}>Track</th>
                <th style={{textAlign:'left', borderBottom:'1px solid #eee', padding:'6px'}}>Artists</th>
                <th style={{textAlign:'left', borderBottom:'1px solid #eee', padding:'6px'}}>Offline</th>
                <th style={{textAlign:'left', borderBottom:'1px solid #eee', padding:'6px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map(t => (
                <Row key={t.id} t={t} onAttach={() => onAttachLocal(t)} onPlay={() => onPlay(t)} />
              ))}
            </tbody>
          </table>
        </> : <p>Select a playlist.</p>}
        <div style={{marginTop:12}}>
          <AutoMatch playlists={playlists} selected={selected} setSelected={setSelected} onBulkAttach={async (mapFiles) => {
            // mapFiles: { trackId: File }
            for (const [tid, file] of Object.entries(mapFiles)) await putFile(tid, file)
            alert('Bulk saved for offline ✓')
            // refresh UI state by forcing a re-render through selected change
            setSelected(s => ({...s}))
          }} />
        </div>
        <Player now={now} audioUrl={audioUrl} setAudioUrl={setAudioUrl} tracks={tracks} playTrack={onPlay} />
      </main>
    </div>
  )
}

function Row({ t, onAttach, onPlay }) {
  const [hasLocal, setHasLocal] = React.useState(false)
  useEffect(() => {
    (async () => setHasLocal(!!(await getFile(t.id))))()
  }, [t.id])

  return (
    <tr>
      <td style={{borderBottom:'1px solid #f3f3f3', padding:'6px'}}>{t.name}</td>
      <td style={{borderBottom:'1px solid #f3f3f3', padding:'6px'}}>{t.artists}</td>
      <td style={{borderBottom:'1px solid #f3f3f3', padding:'6px'}}>{hasLocal ? '✓ Saved' : '—'}</td>
      <td style={{borderBottom:'1px solid #f3f3f3', padding:'6px'}}>
        <button onClick={onAttach} style={{marginRight:8}}>Attach audio</button>
        <button onClick={onPlay}>Play</button>
      </td>
    </tr>
  )
}
