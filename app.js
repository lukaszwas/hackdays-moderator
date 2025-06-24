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
      SEVERE_TOXICITY: {},
      IDENTITY_ATTACK: {},
      INSULT: {},
      PROFANITY: {},
      THREAT: {},
      SEXUALLY_EXPLICIT: {},
      FLIRTATION: {},
      ATTACK_ON_AUTHOR: {},
      ATTACK_ON_COMMENTER: {},
      INCOHERENT: {},
      INFLAMMATORY: {},
      LIKELY_TO_REJECT: {},
      OBSCENE: {},
      SPAM: {},
      UNSUBSTANTIAL: {}
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
    SEVERE_TOXICITY: scores.SEVERE_TOXICITY?.summaryScore.value || 0,
    IDENTITY_ATTACK: scores.IDENTITY_ATTACK?.summaryScore.value || 0,
    INSULT: scores.INSULT?.summaryScore.value || 0,
    PROFANITY: scores.PROFANITY?.summaryScore.value || 0,
    THREAT: scores.THREAT?.summaryScore.value || 0,
    SEXUALLY_EXPLICIT: scores.SEXUALLY_EXPLICIT?.summaryScore.value || 0,
    FLIRTATION: scores.FLIRTATION?.summaryScore.value || 0,
    ATTACK_ON_AUTHOR: scores.ATTACK_ON_AUTHOR?.summaryScore.value || 0,
    ATTACK_ON_COMMENTER: scores.ATTACK_ON_COMMENTER?.summaryScore.value || 0,
    INCOHERENT: scores.INCOHERENT?.summaryScore.value || 0,
    INFLAMMATORY: scores.INFLAMMATORY?.summaryScore.value || 0,
    LIKELY_TO_REJECT: scores.LIKELY_TO_REJECT?.summaryScore.value || 0,
    OBSCENE: scores.OBSCENE?.summaryScore.value || 0,
    SPAM: scores.SPAM?.summaryScore.value || 0,
    UNSUBSTANTIAL: scores.UNSUBSTANTIAL?.summaryScore.value || 0,
    
  };
  const categories = {
    TOXICITY: category_scores.TOXICITY > 0.5,
    SEVERE_TOXICITY: category_scores.SEVERE_TOXICITY > 0.5,
    IDENTITY_ATTACK: category_scores.IDENTITY_ATTACK > 0.5,
    INSULT: category_scores.INSULT > 0.5,
    PROFANITY: category_scores.PROFANITY > 0.5,
    THREAT: category_scores.THREAT > 0.5,
    SEXUALLY_EXPLICIT: category_scores.SEXUALLY_EXPLICIT > 0.5,
    FLIRTATION: category_scores.FLIRTATION > 0.5,
    ATTACK_ON_AUTHOR: category_scores.ATTACK_ON_AUTHOR > 0.5,
    ATTACK_ON_COMMENTER: category_scores.ATTACK_ON_COMMENTER > 0.5,
    INCOHERENT: category_scores.INCOHERENT > 0.5,
    INFLAMMATORY: category_scores.INFLAMMATORY > 0.5,
    LIKELY_TO_REJECT: category_scores.LIKELY_TO_REJECT > 0.5,
    OBSCENE: category_scores.OBSCENE > 0.5,
    SPAM: category_scores.SPAM > 0.5,
    UNSUBSTANTIAL: category_scores.UNSUBSTANTIAL > 0.5
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