# SyncSlide - Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase project (free tier works)

## Supabase Setup

1. **Create a Supabase project** at https://supabase.com
2. Go to **SQL Editor** and run the SQL from `supabase/migration.sql`
3. Go to **Storage** → **Create a new bucket** named `slides` and set it to **public**
4. Go to **Project Settings** → **API** and copy your `Project URL` and `anon public key`
5. Go to **Realtime** → make sure **Realtime is enabled** and the publication includes `sessions`, `slides`, `drawings` tables. Also enable **Broadcast** under Realtime settings.

## Local Setup

1. Create `.env` file in the `whiteboard` directory:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

2. Install and run:
```bash
cd whiteboard
npm install
npm run dev
```

3. Open the URL shown in terminal (default: http://localhost:5173)

## How to Use

### Desktop (Presenter)
1. Open the app → Click **"I'm Presenting"**
2. A 6-character code appears → Share this code with mobile users
3. Wait for "Device connected!" status
4. Start full-screen presentation (click Fullscreen button)
5. When mobile uploads slides, they appear in the thumbnail strip
6. Click a thumbnail to switch slides
7. Drawings from mobile appear instantly on the slide

### Mobile (Joiner)
1. Open the app on your phone → Click **"I'm Joining"**
2. Enter the 6-character code from the desktop
3. You'll see the slide and drawing canvas
4. Use the color picker and size controls to draw
5. **Upload** button → Add presentation slides (images)
6. **Clear** button → Erase all drawings on current slide
7. **Save** button → Download the slide as a PNG image
8. Swipe/select slides from the thumbnail strip to navigate

### Features
- **Real-time sync**: Drawings appear on desktop instantly via Supabase Realtime Broadcast
- **Zero-latency drawing**: Stroke points streamed as you draw
- **Full-screen mode**: Desktop hides all UI elements for clean presentation
- **Multiple slides**: Upload and switch between slides
- **Pen controls**: 11 colors, 5 thickness levels
- **Persistent drawings**: Strokes saved to database and reloaded per slide
- **Auto-reconnect**: If mobile reconnects, drawings are synced from DB

## Architecture

```
┌─────────────┐     Supabase Realtime      ┌─────────────┐
│   Mobile    │◄──── Broadcast Channel ────►│   Desktop   │
│  (Joiner)   │                             │ (Presenter) │
└─────────────┘                             └─────────────┘
     │                                            │
     │  DB Insert/Select                          │  DB Insert/Select
     ▼                                            ▼
┌──────────────────────────────────────────────────────┐
│                    Supabase                          │
│  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌───────┐  │
│  │ sessions │  │ slides │  │ drawings │  │Storage│  │
│  └──────────┘  └────────┘  └──────────┘  └───────┘  │
└──────────────────────────────────────────────────────┘
```

## Deployment

### Deploy to Vercel
```bash
npx vercel --prod
```
Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Vercel dashboard.

### Deploy to Netlify
1. `npm run build`
2. Drop the `dist/` folder into Netlify
3. Add environment variables in Netlify settings
