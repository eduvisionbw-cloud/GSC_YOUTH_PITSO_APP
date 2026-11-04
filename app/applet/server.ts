import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = process.env.PORT || 3000;

  // Initialize Gemini API if key is available
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // API Routes
  app.post('/api/ai/review-pitch', async (req, res) => {
    try {
      const { businessName, category, description, targetMarket, fundingNeeded } = req.body;
      
      if (!ai) {
        // Fallback response if API key is not configured
        return res.json({
          feedback: `Review for ${businessName}: Your ${category} proposal shows strong grassroots potential in Gaborone South. Recommendation: Highlight job creation metrics for local youth, detail your supply chain resilience, and specify how the P${fundingNeeded} micro-grant will scale operations within 6 months. (Mock AI Feedback - configure GEMINI_API_KEY for live generative insights).`,
          score: 84,
          strengths: ['Clear target market', 'Community relevance', 'Feasible budget allocation'],
          suggestions: ['Add sustainability metrics', 'Partner with local cooperatives']
        });
      }

      const prompt = `You are an expert economic development advisor for the Gaborone South Youth Pitso and Youth Enterprise Fund.
Review the following youth business pitch and provide constructive, encouraging, and professional feedback tailored to the Botswana township economy context:

Business Name: ${businessName}
Category: ${category}
Description: ${description}
Target Market: ${targetMarket}
Funding Requested: P${fundingNeeded}

Provide your response in valid JSON format with the following keys:
- feedback (string summary)
- score (number out of 100)
- strengths (array of strings)
- suggestions (array of strings)`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const resultText = response.text || '{}';
      const parsed = JSON.parse(resultText);
      res.json(parsed);
    } catch (err: any) {
      console.error('AI Review Error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate AI pitch review' });
    }
  });

  // Vite middleware setup for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Gaborone South Youth Pitso server running on port ${PORT}`);
  });
}

startServer();
