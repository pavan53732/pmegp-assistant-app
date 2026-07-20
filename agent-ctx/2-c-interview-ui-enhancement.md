---
Task ID: 2-c
Agent: Interview UI Enhancement Agent
Task: Enhance interview chat view with better message bubbles, input, and interactions

Work Log:
- Created `src/components/interview/date-separator.tsx` — reusable date separator component
- Enhanced `src/components/interview/chat-message.tsx` with copy button, gradient overlay, online dot, stagger animation, left border accent, date separator integration
- Enhanced `src/components/interview/chat-input.tsx` with character count, stop button, pulse send button, keyboard hint, tooltip, max length
- Enhanced `src/components/interview/phase-indicator.tsx` with completion badge, improved pulse, auto-scroll, enhanced tooltips
- Enhanced `src/components/interview/chat-view.tsx` with floating particles, shimmer prompts, feature cards, enhanced thinking indicator, error display component
- All changes pass `bun run lint` with zero errors

Stage Summary:
- Date separator, enhanced message bubbles, enhanced chat input, enhanced phase indicator, enhanced welcome screen, enhanced thinking indicator, improved error state — all implemented and lint-clean