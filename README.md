# Comment Moderation App

A simple Node.js app using Express and OpenAI Moderation API to check if user comments are appropriate.

## Requirements
- Node.js (v18+ recommended)
- npm
- OpenAI API key

## How to run locally

1. **Unpack the files** to any directory.

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**

   - Open `.env` and add your OpenAI API key:
     ```env
     OPENAI_API_KEY=your-openai-api-key-here
     PORT=3000 # or any port you prefer
     ```

4. **Start the server:**
   ```bash
   node app.js
   ```

5. **Open your browser:**
   - Go to [http://localhost:3000](http://localhost:3000)

## Files
- `app.js` – Express backend and API integration
- `public/` – Static frontend files (HTML, CSS, JS)

---
