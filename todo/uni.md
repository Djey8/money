# University Project — Money App Landing Page

> **Course:** Web Development (Semester Project)  
> **Strategy:** Each exercise builds on the previous one, progressively enhancing a real marketing/landing page for the Money App.  
> **Repository:** New standalone repo (separate from `Djey8/money`)  
> **Source data:** GitHub API from `https://github.com/Djey8/money`  
> **Design system:** Matches Money App's existing color palette & modern trends  

---

## Color Palette (from Money App)

| Token | Hex | Usage |
|-------|-----|-------|
| Primary (Daily) | `#1976d2` | Headlines, CTAs, links |
| Warning (Splurge) | `#FF9800` | Accent, highlights |
| Success (Smile) | `#4CAF50` | Positive indicators, savings |
| Fire | `#f44336` | Emergency, urgency |
| Text | `#333333` | Body copy |
| Text Secondary | `#666666` | Subtitles, captions |
| Background | `#f5f5f5` | Page background |
| Surface | `#ffffff` | Cards, sections |
| Border | `#cccccc` | Dividers |
| Focus/Accent | `#FFD600` | Interactive focus states |

---

## Roadmap — All 6 Exercises

### Exercise 1 — Static Landing Page (HTML + CSS) ✅ Priority: NOW

**Goal:** A single-page, fully responsive marketing site for Money App. Pure HTML + CSS, no JavaScript. Modern design with CSS animations, smooth scroll, and the 6 feature scenes from `marketing.md`.

**Sections (mapped from video script scenes):**

| # | Scene | Landing Page Section | Content |
|---|-------|---------------------|---------|
| 1 | The Problem | Hero / Hook | "You work hard. You earn money. And yet… it's gone." Eye-catching hero with tagline, CTA button, abstract illustration (CSS shapes or SVG). |
| 2 | Barefoot Buckets | How It Works | Visual 4-bucket system (Daily 60%, Splurge 10%, Smile 10%, Fire 20%). CSS-animated bucket fill bars. Color-coded cards for each bucket. |
| 3 | Mojo & Grow | Build Wealth | Mojo safety target → transition to Grow. Three investment track cards (Assets, Shares, Leveraged). Progress visualization. |
| 4 | Cashflow / Hamster Wheel | Understand Your Money | Income statement vs. balance sheet layout. Assets vs. liabilities visual. "Escape the hamster wheel" messaging. |
| 5 | AI Strategy | Smart Planning | AI prompt generator feature showcase. Privacy-first anonymization highlight. Import flow visualization. |
| 6 | CTA / Closing | Get Started | Final call-to-action. Self-hosted + encrypted + 5 languages + free. Deploy options (Docker, Firebase). Links. |

**Additional sections:**
- **Navigation:** Sticky top nav with smooth-scroll anchor links
- **Features grid:** USP cards (Privacy, Self-hosted, Multi-language, Bucket system, AI, Cashflow)
- **Footer:** Links, language badges, "Your money. Your plan. Your future."

**Design requirements:**
- Mobile-first responsive (breakpoints: 480px, 768px, 1024px, 1200px)
- Modern trends: glassmorphism cards, gradient backgrounds, subtle CSS animations (fade-in on scroll via CSS only), large typography, generous whitespace
- Dark/light aware (CSS `prefers-color-scheme` media query)
- No JavaScript, no build tools, no frameworks
- Deployable to GitHub Pages as-is

**Deliverables:**
- `index.html` — semantic HTML5 structure
- `styles.css` — all styling, animations, responsive rules
- `assets/` — SVG icons/illustrations (inline or file)
- `README.md` — project description

---

### Exercise 2 — Dynamic Page (JavaScript + GitHub API) 🔜 Next

**Goal:** Add JavaScript interactivity and external API integration. Primary use case: **Changelog transparency** — fetch real release data from the Money App GitHub repository.

**Features to add:**

1. **Release Changelog Section**
   - Fetch from `https://api.github.com/repos/Djey8/money/releases`
   - Display release cards: version, date, release notes (markdown → rendered)
   - Collapsible/expandable entries
   - "Latest" badge on most recent release
   - Loading skeleton + error state handling

2. **Repository Stats Bar**
   - Fetch from `https://api.github.com/repos/Djey8/money`
   - Show: stars, forks, language, last updated, open issues
   - Auto-refresh indicator

3. **Commit Activity Timeline**
   - Fetch from `https://api.github.com/repos/Djey8/money/commits?per_page=10`
   - Visual commit timeline (last 10 commits)
   - Author, message, date

4. **Interactive Bucket Calculator**
   - Input: monthly income
   - Output: animated allocation into 4 buckets (Daily 60%, Splurge 10%, Smile 10%, Fire 20%)
   - Adjustable percentages with sliders
   - Real-time update

5. **Smooth scroll & scroll-triggered animations**
   - Replace CSS-only fade-ins with JS IntersectionObserver
   - Parallax effects on hero section

**Technical constraints:**
- Vanilla JavaScript (no libraries/frameworks)
- `fetch()` API for GitHub calls
- DOM manipulation for dynamic content
- `localStorage` for caching API responses (rate limit protection)
- Error handling for API failures (rate limiting, network errors)

**Deliverables:**
- `script.js` — all JavaScript logic
- Updated `index.html` with new sections (changelog, stats)
- Updated `styles.css` with styles for dynamic content

---

### Exercise 3 — Usability Evaluation (Written Analysis)

**Goal:** Conduct a usability evaluation of the Money App landing page (exercises 1+2) using established heuristics and guidelines.

**Approach:**
- Apply **Nielsen's 10 Usability Heuristics** to the page
- Evaluate against **WCAG 2.1 AA** accessibility guidelines
- Test with **3 real users** (think-aloud protocol)
- Document findings: what works, what doesn't, severity ratings
- Propose concrete improvements with mockups/screenshots

**Deliverables:**
- Written evaluation document (~500 words for portfolio)
- Screenshots with annotated issues
- Priority-ranked improvement list

---

### Exercise 4 — Server-Side Programming (Node.js Backend)

**Goal:** Add a lightweight Node.js backend to the landing page for features that require server-side processing.

**Features:**
- **Contact/Feedback form** — server-side validation, email sending or file-based storage
- **Newsletter signup** — store email addresses, send confirmation
- **GitHub API proxy** — server-side caching to avoid client-side rate limits, add authentication for higher limits
- **Analytics endpoint** — anonymous page view tracking (privacy-first, no cookies)

**Tech stack:**
- Node.js + Express
- Server-side rendering for SEO-critical content (optional)
- JSON file storage (no database dependency for simplicity)

---

### Exercise 5 — Modern Framework Rebuild (Angular) 🎯 Key milestone

**Goal:** Rebuild the landing page as an Angular application. This is the exercise where the **interactive demo** becomes reality.

**Features:**
- Component-based architecture matching the 6 sections
- **Embedded demo modules** — for each feature scene, users can interact with a sandboxed version:
  - Bucket allocation: input income, see real bucket splits, drag & adjust
  - Smile project: create a sample dream project with buckets
  - Fire emergency: set up an example emergency fund
  - Cashflow view: enter sample income/expenses, see the classification
  - AI prompt preview: see how the anonymized prompt would look for sample data
- All demo data stored in `localStorage` (no backend, no accounts, fully local)
- Angular routing for section deep-links
- Shared component library matching Money App's design tokens
- i18n support (at least EN + DE)
- SSR with Angular Universal for SEO

**Architecture idea:**
```
src/
  app/
    landing/           ← marketing sections (hero, features, CTA)
    demo/
      bucket-demo/     ← interactive bucket allocator
      smile-demo/      ← sample Smile project creator
      fire-demo/       ← sample Fire emergency planner
      cashflow-demo/   ← sample income/expense classifier
      ai-demo/         ← prompt preview with sample data
    shared/            ← design tokens, UI components
    changelog/         ← GitHub API integration (from exercise 2)
```

---

### Exercise 6 — User-Centered Evaluation (Research)

**Goal:** Formal user-centered evaluation of the Angular landing page (exercise 5).

**Methods (pick 2–3):**
- **A/B testing** — two versions of the hero section, measure engagement
- **System Usability Scale (SUS)** — questionnaire with 5+ participants
- **Task-based usability test** — "Find out how the bucket system works", "Try the demo", "Check the latest release"
- **Heatmap analysis** — track click/scroll patterns (privacy-first: local-only tracking from exercise 4)
- **Accessibility audit** — screen reader testing, contrast checks, keyboard navigation

**Deliverables:**
- Evaluation report (~500 words for portfolio)
- Data tables, charts, SUS scores
- Before/after comparison with exercise 3 evaluation
- Final recommendations

---

## File Structure (New Repository)

```
money-landing/
├── index.html              ← Exercise 1: static page
├── styles.css              ← Exercise 1: all styles
├── script.js               ← Exercise 2: JavaScript + API
├── assets/
│   ├── icons/              ← SVG icons
│   └── images/             ← screenshots, illustrations
├── docs/
│   ├── exercise-3.md       ← Usability evaluation
│   └── exercise-6.md       ← User-centered evaluation
├── backend/                ← Exercise 4: Node.js server
│   ├── server.js
│   ├── package.json
│   └── data/
├── angular-app/            ← Exercise 5: Angular rebuild
│   └── (ng new output)
├── portfolio/              ← Final written portfolio
│   └── portfolio.md
└── README.md
```

---

## Portfolio Reminder

Each exercise → ~500 words covering:
1. What did you learn?
2. What was the hardest part?
3. What stood out?
4. What would you do differently in hindsight?
5. Screenshots of the result

---

## Prompt for Exercise 1 — Copy to New Repository

````markdown
# Prompt: Create Exercise 1 — Money App Landing Page (HTML + CSS)

Create a modern, responsive single-page landing page for "Money App" — a personal finance application. This is a pure HTML + CSS page (no JavaScript, no frameworks, no build tools). It must be deployable to GitHub Pages as-is.

## Design System

Use this exact color palette:

```css
:root {
  --color-primary: #1976d2;       /* Daily bucket — headlines, CTAs */
  --color-primary-hover: #1565c0;
  --color-primary-dark: #0d47a1;
  --color-success: #4CAF50;       /* Smile bucket — positive, savings */
  --color-warning: #FF9800;       /* Splurge bucket — accents */
  --color-fire: #f44336;          /* Fire bucket — urgency, safety */
  --color-focus: #FFD600;         /* Interactive focus */
  --color-text: #333333;
  --color-text-secondary: #666666;
  --color-text-muted: #888888;
  --color-background: #f5f5f5;
  --color-surface: #ffffff;
  --color-border: #cccccc;
}
```

**Typography:** System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

**Design trends to apply:**
- Glassmorphism cards (semi-transparent backgrounds, backdrop-filter blur, subtle borders)
- Gradient hero section (primary blue → dark blue with subtle radial accent)
- Large bold typography for headlines (clamp-based fluid sizing)
- Generous whitespace and padding
- Subtle CSS animations: fade-in sections, floating elements, pulsing CTAs
- Smooth scroll behavior (`scroll-behavior: smooth`)
- `prefers-color-scheme` dark mode support
- Mobile-first responsive (breakpoints: 480px, 768px, 1024px, 1200px)

## Page Structure — 8 Sections

### 1. Navigation (sticky)
- Logo/app name "Money App" on the left
- Anchor links: How It Works, Build Wealth, Cashflow, AI Strategy, Get Started
- Hamburger menu on mobile
- Semi-transparent glassmorphism background on scroll

### 2. Hero Section — "The Problem"
- Large headline: "Take Control of Your Money"
- Subheadline: "You work hard. You earn money. And yet… at the end of every month, it's just gone."
- CTA button: "See How It Works" (scrolls to section 3)
- Secondary CTA: "Self-Host Now" (scrolls to section 7)
- Abstract decorative CSS shapes or SVG illustration (money/coins theme)
- Gradient background

### 3. How It Works — "The Barefoot Investor Bucket System"
- Section title: "Four Buckets. One System. No Thinking Required."
- 4 color-coded cards in a responsive grid:
  - **Daily (60%)** — color: primary blue — "Rent, groceries, utilities. The essentials." Icon: 🏠
  - **Splurge (10%)** — color: warning orange — "Guilt-free spending. You earned it." Icon: 🎉
  - **Smile (10%)** — color: success green — "Your dreams. That trip. The wedding." Icon: ✨
  - **Fire (20%)** — color: fire red — "Your safety net. Because life happens." Icon: 🛡️
- Visual: animated progress bars showing the percentage split (CSS animation, fills on page load)
- Below the cards: "You don't need four bank accounts. Money App creates the virtual separation for you."

### 4. Build Wealth — "Mojo & Grow"
- Two-column layout (stacked on mobile)
- Left: Mojo explanation — "Build your emergency fund first. Once you hit your Mojo target, your safety net is complete."
- Right: Grow tracks — 3 cards for investment types:
  - Assets (gold icon)
  - Shares (chart icon)  
  - Leveraged Investments (building icon)
- Tagline: "Money App doesn't just track spending — it helps you build wealth."

### 5. Cashflow — "Escape the Hamster Wheel"
- Section with a visual split:
  - Left side (red-tinted): "Liabilities" — things that take money OUT (rent, car payments, subscriptions)
  - Right side (green-tinted): "Assets" — things that put money IN (rental income, dividends, side business)
- Quote callout: "The poor and the middle class work for money. The rich have money work for them." — Robert Kiyosaki
- Below: "When your passive income exceeds your expenses — you've escaped the hamster wheel."
- Visual: CSS-animated balance scale or comparison bars

### 6. AI Strategy — "Smart Planning, Zero Data Sharing"
- Feature highlight: AI Prompt Generator
- Three-step flow visualization:
  1. "Your data is anonymized" (shield icon)
  2. "Paste into any AI" (ChatGPT, Claude, Gemini logos/text)
  3. "Import the strategy back" (import icon)
- Prompt types listed: Grow Strategy, Budget Optimizer, Subscription Audit, Smile Creator, Fire Planner
- Privacy callout card: "No API keys. No subscriptions. No data leaves your device."

### 7. Features Grid — USPs
- 6 feature cards in a 2×3 (desktop) / 1×6 (mobile) grid:
  1. 🔒 **Privacy First** — Client-side AES-256 encryption. Your data never leaves unencrypted.
  2. 🏠 **Self-Hosted** — Run on a Raspberry Pi. 3 Docker containers. ~640 MB RAM.
  3. 🌍 **5 Languages** — English, German, Spanish, French, Chinese. Switch instantly.
  4. 🪣 **Bucket System** — Barefoot Investor methodology, automated.
  5. 🤖 **AI-Powered** — Privacy-preserving financial strategy generation.
  6. 📊 **Cashflow Thinking** — Rich Dad Poor Dad asset/liability classification.
- Competitive comparison table (Money App vs. YNAB vs. Mint vs. Toshl vs. Goodbudget) — simplified version from marketing doc

### 8. CTA / Footer — "Get Started"
- Large CTA: "Your money. Your plan. Your future."
- Two deployment option cards:
  - **Self-Hosted** (green accent): "Deploy in 5 minutes with Docker Compose" + code snippet preview
  - **Cloud** (blue accent): "Use Firebase for instant setup" + button
- Footer: copyright, GitHub link, language badges, tagline

## Files to Create

1. **index.html** — Semantic HTML5 (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`). Use proper heading hierarchy. Include meta tags for SEO and social sharing (Open Graph).
2. **styles.css** — All styling. Organized with clear comment sections. CSS custom properties for the color palette. Mobile-first media queries.
3. **README.md** — Project description, how to run (just open index.html), screenshot placeholder.

## Important Constraints
- NO JavaScript
- NO external CSS frameworks (no Bootstrap, Tailwind, etc.)
- NO build tools or preprocessors
- ALL content is static
- Must work by opening index.html directly in a browser
- Must be valid HTML5 and CSS3
- Smooth scroll via CSS `scroll-behavior: smooth`
- Hamburger menu: use CSS-only checkbox hack for mobile toggle

## Content Tone
- Friendly, empowering, slightly playful but credible
- "Your smart friend explaining something over coffee"
- Avoid corporate jargon
- Use the exact bucket names: Daily, Splurge, Smile, Fire
- Reference the Barefoot Investor and Rich Dad Poor Dad by name
````

---

*Last updated: 2026-04-10*
