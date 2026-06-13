# Pinefinders Upload Dashboard — Deployment Guide

This app lets you or your colleagues paste a voice recording transcript and automatically generate Squarespace-ready product listings using Claude AI.

---

## What's in the folder

```
pinefinders-app/
├── index.html        — the dashboard (runs in the browser)
├── api/
│   └── process.js    — secure serverless function (calls Claude API)
└── README.md         — this file
```

---

## Step 1 — Put the files on GitHub

1. Go to [github.com](https://github.com) and sign in (or create a free account).
2. Click **New repository** → give it a name like `pinefinders-dashboard` → click **Create repository**.
3. On your computer, open the `pinefinders-app` folder you downloaded.
4. Drag the entire folder into the GitHub repo page, or use the **uploading an existing file** link.
5. Upload all three items: `index.html`, the `api` folder (containing `process.js`), and `README.md`.
6. Click **Commit changes**.

---

## Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account (free).
2. Click **Add New → Project**.
3. Find your `pinefinders-dashboard` repo and click **Import**.
4. Leave all settings as default — Vercel will auto-detect the setup.
5. Click **Deploy**. Wait about 30 seconds.

Vercel will give you a URL like `https://pinefinders-dashboard.vercel.app`. That's your live app.

---

## Step 3 — Add your Claude API key

**Important:** The API key must be added as a private environment variable — never paste it into the HTML files.

1. In Vercel, go to your project → **Settings → Environment Variables**.
2. Add a new variable:
   - **Name:** `CLAUDE_API_KEY`
   - **Value:** your Anthropic API key (starts with `sk-ant-...`)
3. Click **Save**.
4. Go to **Deployments** → click the three dots on your latest deployment → **Redeploy**.

Your app is now live and fully working.

---

## Step 4 — Share with colleagues

Send them the Vercel URL (e.g. `https://pinefinders-dashboard.vercel.app`).

They open it in any browser on any computer — no installation needed.

---

## How to use the dashboard

1. **Record a voice memo** describing your items — title, code, dimensions, prices.
2. **Get the transcript** — use iPhone Voice Memos (iOS 17+), Otter.ai, or any transcription tool.
3. **Paste the transcript** into the box at the top of the dashboard.
4. Click **Process Transcript** — Claude reads it and generates all the listings automatically.
5. **Review each card** — check for flagged corrections, edit anything needed.
6. **Add a photo** by clicking the photo area on any card.
7. **Approve** the items you're happy with.
8. Click **Export CSV** to download the file.
9. **Import the CSV into Squarespace:** Products → Import → select the file. Items import as hidden — add photos in Squarespace, then publish.

---

## Getting a Claude API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account.
2. Go to **API Keys** → **Create Key**.
3. Copy the key and add it to Vercel as described in Step 3.

You pay only for what you use. Processing a typical transcript of 10–15 items costs a few pence.

---

## Updating the app in future

If you need to make changes to the dashboard or the AI instructions:
1. Edit the files on GitHub (click the file → pencil icon → edit → commit).
2. Vercel automatically redeploys within about 30 seconds.

No technical knowledge needed for most changes — the descriptions and rules are all plain English inside `api/process.js`.
