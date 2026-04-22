# Contributing to Rubix

First off, thank you for considering contributing to Rubix! It's people like you that make Rubix such a great tool for the speedcubing community.

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md) (Standard Contributor Covenant).

---

## 🛠 Getting Started

### Prerequisites
- **Node.js**: 18.x or later
- **Package Manager**: npm (preferred)
- **A Webcam**: For testing the vision-based hand tracking.

### Local Setup
1. **Fork and Clone** the repository:
   ```bash
   git clone https://github.com/nonbangkok/Rubix.git
   cd Rubix
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run the development server**:
   ```bash
   npm run dev
   ```
4. **Open the app**: Navigate to [http://localhost:3000](http://localhost:3000).

---

## 🚀 Development Workflow

1. **Check the Issues**: Before starting, check if there is an existing issue for what you want to work on. If not, please open an issue to discuss your ideas.
2. **Create a Branch**: Use a descriptive branch name.
   - `feature/new-timer-mode`
   - `fix/hand-detection-flicker`
   - `refactor/vision-worker-optimization`
3. **Write Code**: Ensure your code follows our standards (see below).
4. **Self-Test**: Test the hand detection in various lighting conditions and on different devices (mobile/desktop).

---

## 📐 Coding Standards

### TypeScript & React
- Use **Functional Components** and **Hooks**.
- Maintain strict type safety. Avoid using `any` at all costs.
- Use **Zustand** for global state management.
- Keep components focused and small.

### Vision Engine (`/src/lib/vision`)
- **Performance is critical**: Avoid heavy computations on the main thread.
- All MediaPipe processing MUST happen inside the **Web Worker** (`hand.worker.ts`).
- When modifying detection logic in `pad.ts`, ensure that you maintain the "Instant Stop" and "Smoothed Start" behavior.

### UI/UX (HUD Aesthetics)
- Follow the **Immersive HUD** design language (Glassmorphism, dark mode, high contrast).
- Use **CSS Modules** for component-specific styles.
- Ensure all interactive elements have hover/active states.

---

## 📝 Commit Message Guidelines

We follow the **[Conventional Commits](https://www.conventionalcommits.org/)** specification:

- `feat:` for new features (e.g., `feat: add Ao100 statistics`)
- `fix:` for bug fixes (e.g., `fix: resolve timer deadlock on mobile`)
- `perf:` for performance improvements (e.g., `perf: optimize hand landmark processing`)
- `refactor:` for code changes that neither fix a bug nor add a feature
- `docs:` for documentation changes
- `style:` for changes that do not affect the meaning of the code (white-space, formatting, etc.)

---

## 📥 Submitting a Pull Request

1. **Update Documentation**: If you've added a new feature or changed logic, update the `README.md` or `IMPLEMENTATION_PLAN.md` accordingly.
2. **Link the Issue**: Mention the issue number in your PR description (e.g., `Closes #123`).
3. **Quality Check**:
   - Does it pass linting? (`npm run lint`)
   - Is it responsive on mobile?
   - Is the timer accuracy maintained?

---

## 💬 Communication
If you have any questions, feel free to reach out via GitHub Issues or contact the project maintainer.

Happy Cubing! 🧩
