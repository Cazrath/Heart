import React, { useState } from 'react'
import jsmediatags from 'jsmediatags'
import { putFile } from './player-utils'

function readTags(file) {
  return new Promise((res) => {
    try {
      new jsmediatags.Reader(file).setTagsToRead(['title','artist','ISRC']).read({
        onSuccess: (tag) => res({ success:true, tags: tag.tags }),
        onError: () => res({ success:false, tags: {} })
      })
    } catch (e) { res({ success:false, tags: {} }) }
  })
}

function norm(s='') {
  return s.normalize('NFKD').replace(/[^a-z0-9]/gi,'').toLowerCase()
}

export default function AutoMatch({ playlists, selected, setSelected, onBulkAttach }) {
  const [matchMode, setMatchMode] = useState('filename') // or 'tags' or 'isrc'
  const [files, setFiles] = useState([])
  const [preview, setPreview] = useState([])

  function handleFiles(ev) {
    const fs = Array.from(ev.target.files || [])
    setFiles(fs)
    setPreview([])
    Promise.all(fs.map(async f => {
      const t = await readTags(f)
      return { file: f, tags: t.tags || {} }
    })).then(setPreview)
  }

  async function runMatch() {
    if (!selected) return alert('Pick a playlist first.')
    if (files.length === 0) return alert('Choose some audio files to match.')
    // Build map: possible keys -> file
    const map = {}
    for (const item of preview) {
      const fname = norm(item.file.name.replace(/\.[^.]+$/, ''))
      const title = norm(item.tags.title || '')
      const artist = norm(item.tags.artist || '')
      const isrc = (item.tags.ISRC || '').toLowerCase()
      map[item.file.name] = { file: item.file, fname, title, artist, isrc }
    }
    // Fetch tracks for selected playlist via API
    const resp = await fetch(`/api/playlist/${selected.id}/tracks`, { credentials: 'include' })
    const tracks = await resp.json()
    const assignments = {} // trackId -> File
    const unmatchedFiles = new Set(Object.keys(map))

    for (const t of tracks) {
      const tn = norm(t.name)
      const ta = norm(t.artists || '')
      // try match
      let found = null
      if (matchMode === 'filename' || matchMode === 'both') {
        for (const k of Array.from(unmatchedFiles)) {
          if (map[k].fname.includes(tn) || map[k].fname.includes(ta)) { found = k; break }
        }
      }
      if (!found && (matchMode === 'tags' || matchMode === 'both')) {
        for (const k of Array.from(unmatchedFiles)) {
          if (map[k].title.includes(tn) || map[k].artist.includes(ta)) { found = k; break }
        }
      }
      if (!found && matchMode === 'isrc' && t.isrc) {
        for (const k of Array.from(unmatchedFiles)) {
          if (map[k].isrc && map[k].isrc.includes(t.isrc.toLowerCase())) { found = k; break }
        }
      }
      if (found) {
        assignments[t.id] = map[found].file
        unmatchedFiles.delete(found)
      }
    }

    // Attach matched files into IndexedDB
    for (const [tid, file] of Object.entries(assignments)) {
      await putFile(tid, file)
    }

    // Offer to attach unmatched files manually by showing list
    onBulkAttach(assignments)
  }

  return (
    <div style={{padding:12, border:'1px solid #f3f3f3', borderRadius:8, marginBottom:12}}>
      <h4>Auto-match local files</h4>
      <p style={{marginTop:6, marginBottom:6, opacity:.8}}>Upload a batch of your audio files. The app will attempt to match them to tracks in the selected playlist by filename, embedded tags, or ISRC.</p>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <input type="file" multiple accept="audio/*" onChange={handleFiles} />
        <select value={matchMode} onChange={e=>setMatchMode(e.target.value)}>
          <option value="filename">Filename</option>
          <option value="tags">Metadata tags</option>
          <option value="isrc">ISRC</option>
          <option value="both">Filename + tags</option>
        </select>
        <button onClick={runMatch}>Run match</button>
      </div>
      {preview.length>0 && <div style={{marginTop:10, maxHeight:120, overflow:'auto'}}>
        <div style={{fontSize:13, opacity:.8}}>Detected files ({preview.length}):</div>
        <ul>
          {preview.map((p, i) => <li key={i}>{p.file.name} — {p.tags.title || 'no title'} {p.tags.artist ? `— ${p.tags.artist}` : ''}</li>)}
        </ul>
      </div>}
    </div>
  )
}
