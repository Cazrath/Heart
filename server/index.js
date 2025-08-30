import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  SESSION_SECRET,
  PORT = 5174,
  FRONTEND_ORIGIN = 'http://localhost:5173',
} = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI || !SESSION_SECRET) {
  console.warn('[server] Missing env vars. Copy server/.env.example to server/.env and fill values.');
}

const app = express();
app.use(cookieParser());
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set true behind HTTPS + proxy
}));

const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-email',
  'user-library-read'
].join(' ');

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

app.get('/api/login', (req, res) => {
  const state = uuidv4();
  req.session.oauth_state = state;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state
  });
  const url = `https://accounts.spotify.com/authorize?${params.toString()}`;
  res.json({ url });
});

app.get('/api/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || state !== req.session.oauth_state) {
    return res.status(400).json({ error: 'Invalid state or code' });
  }
  try {
    const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI
    });
    const tokenResp = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` }
    });
    req.session.access_token = tokenResp.data.access_token;
    req.session.refresh_token = tokenResp.data.refresh_token;
    res.redirect(FRONTEND_ORIGIN + '/app');
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    const refresh_token = req.session.refresh_token;
    if (!refresh_token) return res.status(401).json({ error: 'Not logged in' });
    const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token
    });
    const tokenResp = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` }
    });
    req.session.access_token = tokenResp.data.access_token;
    res.json({ ok: true });
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

app.get('/api/me', async (req, res) => {
  try {
    const token = req.session.access_token;
    if (!token) return res.status(401).json({ error: 'Not logged in' });
    const { data } = await axios.get('https://api.spotify.com/v1/me', { headers: authHeader(token) });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.get('/api/playlists', async (req, res) => {
  try {
    const token = req.session.access_token;
    if (!token) return res.status(401).json({ error: 'Not logged in' });
    const items = [];
    let url = 'https://api.spotify.com/v1/me/playlists?limit=50';
    while (url) {
      const { data } = await axios.get(url, { headers: authHeader(token) });
      items.push(...data.items.map(p => ({ id: p.id, name: p.name, tracksHref: p.tracks.href })));
      url = data.next;
    }
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

app.get('/api/playlist/:id/tracks', async (req, res) => {
  try {
    const token = req.session.access_token;
    if (!token) return res.status(401).json({ error: 'Not logged in' });
    let url = `https://api.spotify.com/v1/playlists/${req.params.id}/tracks?limit=100`;
    const tracks = [];
    while (url) {
      const { data } = await axios.get(url, { headers: authHeader(token) });
      for (const it of data.items) {
        const t = it.track;
        if (!t) continue;
        tracks.push({
          id: t.id,
          name: t.name,
          artists: t.artists?.map(a => a.name).join(', ') || '',
          duration_ms: t.duration_ms,
          isrc: t.external_ids?.isrc || null
        });
      }
      url = data.next;
    }
    res.json(tracks);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
