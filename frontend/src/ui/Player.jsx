import React, { useEffect, useRef, useState } from 'react'
import { getFile } from './player-utils'

export default function Player({ now, audioUrl, setAudioUrl, tracks, playTrack }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    const audio = document.getElementById('player') || audioRef.current
    if (!audio) return
    const onTime = () => setProgress(audio.currentTime)
    const onDur = () => setDuration(audio.duration || 0)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('play', () => setPlaying(true))
    audio.addEventListener('pause', () => setPlaying(false))
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
    }
  }, [audioRef])

  async function playLocal(t) {
    const blob = await getFile(t.id)
    if (!blob) return alert('No local file attached for this track yet. Click "Attach audio".')
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    const url = URL.createObjectURL(blob)
    setAudioUrl(url)
    const audio = document.getElementById('player') || audioRef.current
    audio.src = url
    await audio.play()
  }

  function togglePlay() {
    const audio = document.getElementById('player') || audioRef.current
    if (!audio.src) return
    if (audio.paused) audio.play(); else audio.pause()
  }

  function seekTo(e) {
    const audio = document.getElementById('player') || audioRef.current
    const rect = e.target.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = x / rect.width
    audio.currentTime = pct * (audio.duration || 0)
  }

  // Simple circular volume control using pointer events on an SVG ring
  const ringRef = useRef(null)
  useEffect(() => {
    const el = ringRef.current
    if (!el) return
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width/2
      const cy = r.top + r.height/2
      const ang = Math.atan2(e.clientY - cy, e.clientX - cx) // -PI..PI
      const deg = (ang * 180/Math.PI + 360 + 90) % 360 // 0..360 with top = 0
      const v = deg / 360
      setVolume(v)
      const audio = document.getElementById('player') || audioRef.current
      if (audio) audio.volume = v
    }
    const onPointerDown = (e) => {
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', ()=> {
        window.removeEventListener('pointermove', onMove)
      }, { once: true })
      onMove(e)
    }
    el.addEventListener('pointerdown', onPointerDown)
    return () => el.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div style={{position:'fixed', left:280, right:0, bottom:0, borderTop:'1px solid #eee', padding:12, background:'#fff', display:'flex', alignItems:'center', gap:12}}>
      <audio id="player" ref={audioRef} controls style={{display:'none'}}></audio>
      <div style={{display:'flex', gap:12, alignItems:'center', minWidth:320}}>
        <div style={{width:64, height:64, background:'#f3f3f3', borderRadius:6, display:'grid', placeItems:'center'}}>
          {now ? <div style={{fontSize:12, padding:6}}>{now.name}</div> : <div style={{fontSize:12}}>No track</div>}
        </div>
        <div style={{minWidth:220}}>
          <div style={{fontWeight:600}}>{now ? now.name : '—'}</div>
          <div style={{fontSize:12, opacity:.7}}>{now ? now.artists : ''}</div>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button onClick={async ()=> {
            // prev: find index
            if (!now) return
            const i = tracks.findIndex(t=>t.id===now.id)
            if (i>0) playTrack(tracks[i-1])
          }}>Prev</button>
          <button onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
          <button onClick={async ()=> {
            if (!now) return
            const i = tracks.findIndex(t=>t.id===now.id)
            if (i < tracks.length-1) playTrack(tracks[i+1])
          }}>Next</button>
        </div>
      </div>
      <div style={{flex:1, marginRight:12}}>
        <div onClick={seekTo} style={{height:8, background:'#eee', borderRadius:6, position:'relative', cursor:'pointer'}}>
          <div style={{position:'absolute', left:0, top:0, bottom:0, width: (duration? (progress/duration*100) : 0) + '%', background:'#000', borderRadius:6}}></div>
        </div>
        <div style={{fontSize:12, opacity:.7, marginTop:6}}>{Math.floor(progress)}/{Math.floor(duration)}</div>
      </div>
      <div style={{width:80, display:'flex', flexDirection:'column', alignItems:'center'}}>
        <svg ref={ringRef} width="64" height="64" viewBox="0 0 100 100" style={{touchAction:'none', cursor:'pointer'}}>
          <circle cx="50" cy="50" r="30" stroke="#eee" strokeWidth="12" fill="none"></circle>
          <circle cx="50" cy="50" r="30" stroke="#000" strokeWidth="12" fill="none" strokeDasharray={`${Math.max(0, volume*2*Math.PI*30)} ${2*Math.PI*30}`} strokeLinecap="round" transform="rotate(-90 50 50)"></circle>
          <text x="50" y="55" textAnchor="middle" fontSize="12">{Math.round(volume*100)}</text>
        </svg>
        <div style={{fontSize:11, opacity:.7}}>Volume</div>
      </div>
    </div>
  )
}
