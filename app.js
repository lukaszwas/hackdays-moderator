import 'dotenv/config'; // Load environment variables from .env file
import express from 'express'; // Import Express framework
import OpenAI from 'openai'; // Import OpenAI SDK
import { observeOpenAI } from "langfuse"; // Import Langfuse for observability (optional)
import fetch from 'node-fetch'; // For PerspectiveAPI HTTP requests

const app = express();
app.use(express.json()); // Parse JSON bodies
app.use(express.static('public')); // Serve static files from the 'public' directory

// Initialize OpenAI client and wrap with Langfuse observability
const openai = observeOpenAI(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Your OpenAI API key from .env
}));
const PORT = process.env.PORT || 3000; // Use port from env or default to 3000

// PerspectiveAPI moderation function
async function moderateWithPerspectiveAPI(comment) {
  const apiKey = process.env.PERSPECTIVE_API_KEY;
  if (!apiKey) throw new Error('Perspective API key not set');
  const url = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`;
  const body = {
    comment: { text: comment },
    languages: ['en'],
    requestedAttributes: {
      TOXICITY: {},
      INSULT: {},
      IDENTITY_ATTACK: {}
    }
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error('PerspectiveAPI error');
  const data = await response.json();
  // Compose a result similar to OpenAI's output
  const scores = data.attributeScores || {};
  const category_scores = {
    TOXICITY: scores.TOXICITY?.summaryScore.value || 0,
    INSULT: scores.INSULT?.summaryScore.value || 0,
    IDENTITY_ATTACK: scores.IDENTITY_ATTACK?.summaryScore.value || 0
  };
  const categories = {
    TOXICITY: category_scores.TOXICITY > 0.5,
    INSULT: category_scores.INSULT > 0.5,
    IDENTITY_ATTACK: category_scores.IDENTITY_ATTACK > 0.5
  };
  const flagged = Object.values(categories).some(Boolean);
  return { flagged, categories, category_scores };
}

// Moderation endpoint: receives a comment and checks it using OpenAI Moderation API
app.post('/moderate', async (req, res) => {
  const { comment, moderator } = req.body;
  if (!comment) {
    return res.status(400).json({ error: 'No comment provided.' });
  }
  try {
    if (moderator === 'perspectiveapi') {
      const result = await moderateWithPerspectiveAPI(comment);
      return res.json(result);
    } else {
      // Default to OpenAI
      const moderation = await openai.moderations.create({
        model: 'omni-moderation-latest',
        input: comment,
      });
      if (!moderation.results || !moderation.results[0]) {
        return res.status(500).json({ error: 'Invalid response from moderation API.' });
      }
      res.json(moderation.results[0]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Moderation API error.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 