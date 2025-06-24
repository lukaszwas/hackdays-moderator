import 'dotenv/config'; // Load environment variables from .env file
import express from 'express'; // Import Express framework
import OpenAI from 'openai'; // Import OpenAI SDK
import { observeOpenAI } from "langfuse"; // Import Langfuse for observability (optional)

const app = express();
app.use(express.json()); // Parse JSON bodies
app.use(express.static('public')); // Serve static files from the 'public' directory

// Initialize OpenAI client and wrap with Langfuse observability
const openai = observeOpenAI(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Your OpenAI API key from .env
}));
const PORT = process.env.PORT || 3000; // Use port from env or default to 3000

// Moderation endpoint: receives a comment and checks it using OpenAI Moderation API
app.post('/moderate', async (req, res) => {
  const { comment } = req.body;
  if (!comment) {
    // If no comment is provided, return an error
    return res.status(400).json({ error: 'No comment provided.' });
  }
  try {
    // Call OpenAI Moderation API with the latest model
    const moderation = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: comment,
    });
    // Check if the response is valid
    if (!moderation.results || !moderation.results[0]) {
      return res.status(500).json({ error: 'Invalid response from moderation API.' });
    }
    // Return the moderation result to the frontend
    res.json(moderation.results[0]);
  } catch (err) {
    // Handle errors from the API
    res.status(500).json({ error: 'Moderation API error.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 