# Samvād — Figma AI Design Prompts

> Copy-paste each prompt separately into Figma AI. Each generates one mobile screen (375px iPhone frame).

---

## SCREEN 1: Main Conversation Screen

```
Design a mobile voice companion app screen (375x812 iPhone frame) called "Samvād" — an AI news companion you talk to about the news.

LAYOUT (top to bottom):
- Top bar: App name "Samvād" in bold left-aligned, small subtitle "AI News Companion" underneath in muted text. Right side: a small gear icon for settings.
- Current topic indicator: A thin horizontal strip showing the current story being discussed, like "ECB Rate Decision — BBC News" with a small orange dot indicating active topic.
- Transcript area (main scrollable area, takes up ~55% of screen): Shows the conversation as alternating chat bubbles. AI messages are left-aligned with a warm beige background (#FFF0C3) and black text. User messages are right-aligned with orange background (#FF8205) and black text. The latest message should show text appearing word-by-word (streaming indicator). Include 3-4 example messages showing a news briefing conversation.
- Entity chips: A horizontally scrollable row of small pill-shaped chips below the transcript — each shows an entity name mentioned in the conversation like "ECB", "Christine Lagarde", "Bank of England". Chips have a 2px black border, beige background, and tapping one would ask the AI about it.
- Waveform area: A centered audio waveform visualization — subtle animated bars. Below it, a status label saying "Samvād is speaking..." in small muted text.
- Mic button: Large circular microphone button at the bottom center (64px), orange (#FF8205) background with a white mic icon. Slight shadow for depth. Below it, tiny text: "Tap to speak".

COLOR PALETTE:
- Page background: #FFFAEB (warm cream/beige)
- Card/bubble backgrounds: #FFF0C3 (warm beige)
- Primary accent: #FF8205 (orange)
- Hover/active accent: #FA500F (dark orange)
- Text: #000000 (black) and #1E1E1E (dark tinted)
- Borders/dividers: #E9E2CB (muted beige)
- NO blues, purples, or gradients. All flat colors.

STYLE:
- Font: Inter or SF Pro (clean sans-serif)
- Corners: 12px border-radius on cards and bubbles, 32px on mic button (fully round), 16px on entity chips
- Clean and modern, warm palette, generous whitespace
- No pixel art or retro elements — this should feel like a polished, warm, modern mobile app
- Spacing follows 8px grid
```

---

## SCREEN 2: Article Mode Screen

```
Design a mobile screen (375x812 iPhone frame) for an AI news companion app called "Samvād" — this is the Article Mode where a user pastes a news article URL and the AI walks them through it.

LAYOUT (top to bottom):
- Top bar: Back arrow on the left, "Article Mode" as the centered title in bold, a share icon on the right.
- URL input area: A large input field with placeholder text "Paste an article URL..." with a beige background (#FFF0C3), 2px border (#E9E2CB), and an orange "Go" button to the right of the input. The input and button sit inside a slightly padded card.
- Article preview card (shown after URL is pasted): A card with the article headline in bold ("ECB Signals Rate Pause as Inflation Fears Persist"), source name and time ("BBC News · 2 hours ago"), and a small thumbnail image on the right side of the card. Below the headline, show 3-4 entity chips extracted from the article: "ECB", "Christine Lagarde", "Eurozone", "Inflation" — small pills with 2px black border and beige background.
- AI prompt suggestions: Below the article card, show 3 tappable suggestion cards stacked vertically:
  1. "Walk me through this article" — with a small play icon
  2. "Summarize the key points" — with a small list icon  
  3. "Explain the background" — with a small book icon
  Each suggestion is a rounded card with beige background, orange left border (3px), and black text.
- Bottom section: Same mic button and waveform area as the main screen — large orange circular mic button (64px) centered at bottom with "Tap to ask about this article" text below.

COLOR PALETTE:
- Page background: #FFFAEB (warm cream)
- Cards and inputs: #FFF0C3 (warm beige)
- Primary accent: #FF8205 (orange)
- Text: #000000 and #1E1E1E
- Borders: #E9E2CB
- NO blues, purples, or gradients. Flat colors only.

STYLE:
- Font: Inter or SF Pro (clean sans-serif)
- Corners: 12px on cards, 8px on input fields, 16px on chips, 32px on mic button
- Modern and clean, warm tones, generous spacing
- The suggestion cards should feel tappable and inviting
- 8px grid spacing throughout
```

---

## SCREEN 3: Settings Screen

```
Design a mobile settings screen (375x812 iPhone frame) for an AI news companion app called "Samvād".

LAYOUT (top to bottom):
- Top bar: Back arrow on left, "Settings" as centered bold title.
- Profile section: A small card at the top with a user avatar circle (placeholder), name "Devashish" in bold, and email below in muted text. An "Edit" text link in orange (#FF8205) on the right.
- Settings groups organized in sections with section headers in uppercase small muted text (12px, #1E1E1E, letter-spacing 0.05em):

SECTION: "NEWS PREFERENCES"
- "Topics" — right side shows "Tech, Europe, Science" as small orange text, with a chevron arrow
- "Sources" — right side shows "6 sources" with chevron
- "Briefing Length" — a segmented control with 3 options: "Short", "Medium", "Detailed" — Medium is selected (orange background)

SECTION: "VOICE"
- "AI Voice" — right side shows "Aria" with chevron (voice selection)
- "Speech Speed" — a slider from slow to fast, thumb is orange
- "Auto-listen" — toggle switch on the right (orange when on, beige when off). Description text below: "Start listening automatically after AI finishes speaking"

SECTION: "ABOUT"
- "How Samvād Works" with chevron
- "Send Feedback" with chevron
- "Version 1.0.0 (Hackathon)" in centered muted small text at the bottom

Each setting row is a horizontal bar: label on left, control/value on right, separated by thin 1px beige dividers (#E9E2CB). Rows have 16px vertical padding.

COLOR PALETTE:
- Page background: #FFFAEB
- Card backgrounds: #FFF0C3
- Active/selected: #FF8205 (orange)
- Text: #000000 primary, #1E1E1E secondary
- Dividers: #E9E2CB
- NO blues, purples, gradients.

STYLE:
- Font: Inter or SF Pro
- Corners: 12px on cards and segmented control, 32px on avatar and toggle
- Clean, warm, modern iOS-style settings layout
- Generous padding and whitespace
- Section headers feel organized and scannable
- 8px grid spacing
```

---

## BONUS: Design System Notes for Figma AI

If Figma AI asks for additional context or you want to generate a component library:

```
Create a component library for a mobile app called "Samvād" with this design system:

Colors:
- Background: #FFFAEB (warm cream)
- Surface/Cards: #FFF0C3 (warm beige)  
- Primary accent: #FF8205 (orange)
- Active/hover: #FA500F (dark orange)
- Highlight: #FFAF00 (light orange)
- Warning: #FFD800 (yellow)
- Error: #E10500 (red)
- Text primary: #000000
- Text secondary: #1E1E1E
- Borders: #E9E2CB
- NO blues, purples, or cool grays anywhere

Components to generate:
1. Chat bubble (AI variant — beige left-aligned, User variant — orange right-aligned)
2. Entity chip (pill shape, 2px black border, beige fill, tappable)
3. Mic button (3 states: idle/orange, listening/pulsing red, disabled/gray)
4. Waveform bar (3 states: idle/subtle, listening/blue-tinted, speaking/green-tinted)
5. Suggestion card (beige bg, orange left border, icon + text)
6. Article preview card (thumbnail + headline + source + entity chips)
7. Settings row (label + value/control + divider)
8. Status pill ("Listening...", "Thinking...", "Speaking..." — small indicator)
9. Top bar (title + subtitle + icon)
10. Segmented control (3 options, orange selected state)

Style: Modern, warm, clean. 12px border-radius on cards, 16px on chips, 32px on circles. Inter or SF Pro font. 8px grid. No retro/pixel elements.
```