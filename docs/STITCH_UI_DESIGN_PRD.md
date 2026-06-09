# RouteGPT UI Design PRD for Google Stitch

## 1. Purpose

Design a simple, basic, ChatGPT-like interface for RouteGPT. The app should feel like a clean transport chat assistant, not a marketing website or complex dashboard.

The first screen should be the usable chat interface. Users should be able to type a route question immediately.

## 2. Product Context

RouteGPT is a conversational transport assistant for Dhaka. Users ask questions like:

- "Gabtoli theke Mirpur 1 bus e jabo"
- "Mirpur 10 to Motijheel"
- "Gulshan theke Dhanmondi CNG te"

The UI should support a simple chat workflow where the assistant returns bus, CNG, Pathao, and Uber estimates.

## 3. Design Direction

### Overall Style

- Simple and basic.
- Inspired by ChatGPT's clean chat interface.
- Minimal visual decoration.
- White or very light gray background.
- Clear typography.
- No hero section.
- No landing page.
- No large marketing text.
- No colorful decorative gradients.
- No complex dashboard layout.
- No unnecessary cards except for transport results and account window.

### Personality

- Calm.
- Helpful.
- Practical.
- Local transport focused.
- Easy for commuters to understand quickly.

## 4. Core Screens

### 4.1 Chat Screen

This is the main app screen.

Required layout:

- Top header bar.
- Left side or top-left app name: `RouteGPT`.
- Main conversation area.
- User and assistant messages.
- Input bar fixed at the bottom.
- Send button beside the input.
- Account/profile button in the top-right corner.

The interface should look familiar to users of modern AI chat apps.

### 4.2 Account Information Window

This should be a small modal or side panel opened from the profile button.

Required account fields:

- User name.
- Email.
- Student status.
- Preferred language.

Required actions:

- Edit profile.
- Save changes.
- Close window.

Keep this window basic. It should not include billing, subscriptions, settings, analytics, or advanced preferences.

## 5. Chat UI Requirements

### Empty State

When no messages exist, show a simple centered prompt:

```text
Where do you want to go?
```

Below it, show 3 small example prompts:

- `Gabtoli to Mirpur 1`
- `Bashundhara theke Jatrabari bus`
- `Gulshan to Dhanmondi CNG`

### Message Style

User messages:

- Aligned to the right.
- Light neutral bubble.
- Rounded but not overly pill-shaped.

Assistant messages:

- Aligned to the left.
- Plain text area or subtle bubble.
- Easy to scan.

### Input Bar

The input area should include:

- Text input placeholder: `Ask a route...`
- Send button.
- Optional mode icon or simple plus button only if needed later.

Do not add voice input, file upload, map tools, or advanced toolbar controls for the MVP.

## 6. Transport Result Cards

When RouteGPT returns structured transport results, show compact result cards inside the assistant response.

Card types:

- Bus.
- CNG.
- Pathao Bike.
- Pathao Car.
- Uber Moto.
- Uber Go.

Each result card should show only:

- Mode name.
- Fare or fare range.
- Student fare if bus result.
- Short route summary.
- `Report wrong info` button.

Example bus card:

```text
Bus
Achim Paribahan
Fare: BDT 40
Student: BDT 20
Gabtoli -> Mirpur 1
Report wrong info
```

Example estimate card:

```text
Pathao Bike
~BDT 80-110
Actual app fare may vary.
```

Keep cards compact and practical. Avoid large images, illustrations, or decorative elements.

## 7. Header Requirements

Header should include:

- App name: `RouteGPT`.
- Optional small subtitle: `Dhaka transport assistant`.
- Profile/account icon button.

Do not include:

- Pricing links.
- Marketing navigation.
- Blog links.
- Feature menus.
- Large logo treatment.

## 8. Account Window Details

### Display Mode

Show:

```text
Name: User Name
Email: user@example.com
Student: Yes / No
Preferred language: Banglish / Bengali / English
```

### Edit Mode

Fields:

- Name text input.
- Email text input.
- Student checkbox or toggle.
- Preferred language dropdown.

Buttons:

- Save.
- Cancel.

Design this as a small modal on desktop and a bottom sheet or full-width panel on mobile.

## 9. Responsive Behavior

### Mobile

- Header stays compact.
- Chat input remains fixed at bottom.
- Account window opens as a full-width modal or bottom sheet.
- Result cards stack vertically.
- Text must not overflow.

### Desktop

- Chat area centered with a comfortable max width.
- Account window opens as a modal or right-side panel.
- Input bar stays aligned with chat width.

## 10. Visual System

### Colors

Use a neutral palette:

- Background: white or very light gray.
- Text: near black.
- Secondary text: medium gray.
- Borders: light gray.
- Primary action: simple dark button or subtle blue.

Avoid:

- Heavy gradients.
- Bright multi-color theme.
- Purple-heavy design.
- Decorative background shapes.

### Typography

- Use a clean sans-serif font.
- Keep headings modest.
- Chat text should be comfortable to read.
- Do not use oversized hero typography.

### Spacing

- Keep spacing calm and practical.
- Do not make the UI feel empty or overly spacious.
- Result cards should be dense enough for commuting information.

## 11. Interaction Requirements

### Sending a Message

User types a route question and presses send. The message appears in the conversation, then the assistant shows a loading state.

### Loading State

Use a simple typing indicator or small spinner.

### Report Wrong Info

When the user clicks `Report wrong info`, show a tiny confirmation state:

```text
Thanks, we received your report.
```

No full feedback form is required for the first design.

## 12. Accessibility Requirements

- Buttons must have clear labels.
- Text contrast must be readable.
- Input field must be easy to tap on mobile.
- Modal must have a clear close button.
- Avoid tiny text for fare information.

## 13. What Not To Design

Do not design:

- Landing page.
- Marketing homepage.
- Onboarding flow.
- Payment page.
- Admin dashboard.
- Map-heavy interface.
- Login/signup screens unless absolutely necessary.
- Advanced settings page.
- Notification center.
- Saved routes page.

## 14. Google Stitch Prompt

Use this prompt in Google Stitch:

```text
Design a simple ChatGPT-like web app interface for RouteGPT, a Dhaka transport assistant.

The first screen must be the actual chat interface, not a landing page. Keep everything minimal, basic, and practical.

Layout:
- Top header with RouteGPT on the left and a profile/account icon on the right.
- Main centered chat conversation area.
- Empty state text: "Where do you want to go?"
- Show three example prompts: "Gabtoli to Mirpur 1", "Bashundhara theke Jatrabari bus", "Gulshan to Dhanmondi CNG".
- Bottom fixed chat input with placeholder "Ask a route..." and a send button.

Messages:
- User messages align right in subtle neutral bubbles.
- Assistant messages align left.
- Assistant can show compact transport result cards for Bus, CNG, Pathao Bike, Pathao Car, Uber Moto, and Uber Go.

Transport cards:
- Keep cards compact.
- Show mode name, fare, student fare for bus, short route summary, and "Report wrong info" button.
- Do not use large images or decorative illustrations.

Account window:
- Clicking the profile icon opens a small account information modal or side panel.
- Show name, email, student status, and preferred language.
- Include Edit profile, Save, Cancel, and Close controls.
- Keep it basic only.

Visual style:
- Inspired by ChatGPT.
- White or very light gray background.
- Clean sans-serif typography.
- Light gray borders.
- Simple dark or subtle blue primary button.
- No landing page, no hero section, no marketing navigation, no gradients, no decorative backgrounds, no complex dashboard.

Responsive:
- Mobile-first.
- Chat input fixed at bottom.
- Result cards stack vertically.
- Account window becomes a mobile-friendly modal or bottom sheet.
```

## 15. Acceptance Criteria

- Design opens directly to chat.
- UI looks simple and familiar.
- User can clearly see where to type a route.
- Account information is accessible from the profile button.
- Transport results are compact and readable.
- No unnecessary screens or advanced features are introduced.
