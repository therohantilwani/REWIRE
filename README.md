# Rewire 🧠

> A 3-week dopamine reset tracker. Not another productivity app — a science-backed protocol to fix why nothing feels interesting anymore.

---

## The problem

You're not lazy. You're not burned out. Your brain's reward system is broken from years of high-stimulation content.

Every time you scroll reels, your brain gets a dopamine hit with zero effort. Over time it downregulates — meaning it needs more stimulation just to feel normal. The result: work feels flat, hobbies feel boring, and you can't focus for more than a few minutes. This isn't a motivation problem. It's a neuroscience problem.

Rewire is built around one idea: you can retrain your brain's reward system in 21 days.

---

## How it works

The app is structured around a 3-week protocol derived from research on addiction, behavioral psychology, and reward prediction error.

### Week 1 — Subtract
Cut the high-stimulation inputs so your baseline can reset.

- No short-form content (reels, shorts, stories)
- Eat at least one meal with no screens
- 20 minutes of intentional boredom daily — sit or walk without headphones

### Week 2 — Rewire
Reintroduce effort-based rewards and controlled novelty.

- 10–20 minutes of deep focus work or reading
- Try one small uncomfortable thing you'd normally avoid
- Reach out to someone you haven't spoken to in a while

### Week 3 — Foundation
Lock in the biological conditions your brain needs to sustain the reset.

- 7–8 hours of sleep with your phone out of the room
- At least 10 minutes of physical movement
- One face-to-face conversation

Each week unlocks progressively — week 2 habits appear on day 8, week 3 on day 15.

---

## Features

### Onboarding assessment
An 8-question yes/no self-assessment that scores how affected your dopamine system currently is. Honest answers only — it's just for you. Score is saved and used to measure your progress after day 21.

### Daily habit tracker
- Shows your current day (e.g. "Day 6 of 21") and active week theme
- Checkboxes for each habit — tap to complete
- A quick note field for a one-sentence reflection on the day
- 7-day streak indicator

### Progress view
- 21-day grid map — each day lights up green when at least one habit is checked
- Stats: days in, current streak, habits completed today, starting score
- Re-score after day 21 to see how your answers changed
- AI check-in button — sends your current progress and returns a short, direct message (no toxic positivity)

### Reflection journal
- Free-form daily journal entries
- All past entries saved and shown in reverse chronological order
- Entries tagged as `note` (quick) or `journal` (full reflection)

### Persistent storage
All data — start date, initial score, daily habit checks, and journal entries — is stored locally. No account required to get started.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React / HTML + CSS |
| Storage | localStorage → Supabase (free tier) |
| Analytics | PostHog (free tier) |
| Email capture | Brevo |
| AI check-in | Anthropic Claude API (claude-haiku) |
| Hosting | Vercel |

---

## Screens

```
Onboarding         Today              Progress           Reflect
──────────         ─────              ────────           ───────
Self-assessment    Day X of 21        21-day grid        Journal entry
Score out of 8     Week theme badge   Streak stats       Past entries
Start CTA          Habit checklist    Re-score button    Tagged by type
                   Quick note field   AI check-in
```

---

## Roadmap

- [x] Core habit tracker (3-week protocol)
- [x] Self-assessment with score
- [x] Streak and 21-day progress map
- [x] Reflection journal
- [x] AI check-in
- [ ] Push notifications (day streak reminders)
- [ ] Cross-device sync via Supabase
- [ ] Re-score comparison after day 21
- [ ] iOS app (post web PoC validation)
- [ ] Android app
- [ ] Paid unlock — journal history export, extended protocol, AI daily summary

---

## Getting started

```bash
git clone https://github.com/yourusername/rewire
cd rewire
npm install
npm run dev
```

Open `http://localhost:3000` and go through the assessment to begin your reset.

---

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_key
```

---

## Monetization

Rewire is free to start. A one-time unlock (~$3.99) will gate:

- Journal history export
- AI daily summary
- Extended 30-day protocol
- Cross-device sync

No subscription. No ads. The whole point of this app is to reduce compulsive behavior — it would be hypocritical to monetize attention.

---

## Background

Built by [Rohan](https://github.com/yourusername) — MS Computer Science (University of the Pacific, 2026), NLP + cybersecurity researcher. This app came out of a personal frustration: I knew exactly what the problem was, I'd read the science, and I still couldn't find a tool that took it seriously without being another gamified dopamine trap itself.

The neuroscience behind this app is real. Reward prediction error, dopamine downregulation, and the wanting vs. liking distinction are well-established — not wellness content. The protocol is based on multiple research papers on addiction recovery and behavioral psychology.

---

## Contributing

This is an early-stage PoC. If you try the 21-day protocol and have feedback, open an issue or reach out directly. Feature requests welcome — especially around what would make you actually stick to it.

---

## License

MIT
