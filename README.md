# CrewAI Marketing Automation Tutorial

This repository demonstrates a multi‑agent marketing workflow built with **CrewAI**, **Gemini**, and **Serper** tools. The crew automates:

- Market research
- Strategy creation
- Content calendar generation
- Social‑media post drafts
- Blog drafts and SEO optimization

## Project Structure
```
crewai-tutorial/
├─ .env                # API keys (keep secret)
├─ .gitignore          # Ignored files
├─ README.md           # Project overview (this file)
├─ marketing-crew/     # Crew definition and config
│   ├─ crew.py
│   ├─ config/
│   │   ├─ agents.yaml
│   │   └─ tasks.yaml
│   └─ resources/
│       └─ drafts/      # Generated markdown outputs
├─ config/             # Global config files (agents/tasks)
├─ .venv/              # Virtual environment (ignored)
└─ ...
```

## Setup
1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd crewai-tutorial
   ```
2. **Create a virtual environment** (recommended)
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   ```
3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```
4. **Add your API keys** to a `.env` file at the project root:
   ```
   GEMINI_API_KEY=your_gemini_key
   SERPER_API_KEY=your_serper_key
   ```
   *The `.env` file is ignored by Git.*

## Running the Crew
```bash
uv run marketing-crew/crew.py
```
The crew will generate markdown files under `resources/drafts/` (e.g., `marketing_strategy.md`, `content_calendar.md`).

## Notes
- The project uses **UTF‑8** console handling for Windows compatibility.
- If you encounter Gemini quota errors, switch to a paid model in `agents.yaml`.
- Ensure the `resources/drafts` folder exists before running.

---
*Built with ❤️ by the CrewAI community.*
