import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, getDoc, collection, getDocs, 
  query, increment, serverTimestamp 
} from 'firebase/firestore';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());

// Initialize Firebase for server operations
let serverDb: any = null;
try {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const serverApp = getApps().length === 0 
      ? initializeApp(configData, 'pitso-backend') 
      : getApps()[0];
    serverDb = getFirestore(serverApp);
    console.log('[Server] Firebase Firestore connected to project:', configData.projectId);
  }
} catch (fbErr) {
  console.warn('[Server] Firebase setup notice:', fbErr);
}

const PORT = process.env.PORT || 3000;

  // Initialize Gemini API if key is available
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // Direct Registration API Route (guarantees instantaneous saves regardless of browser extensions/adblockers)
  app.post('/api/register', async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.phone || !data.email) {
        return res.status(400).json({ error: 'Missing required registration details' });
      }

      if (!serverDb) {
        return res.status(503).json({ error: 'Database service not yet initialized on server' });
      }

      const categoryTag = String(data.type || 'individual').toUpperCase();
      const phoneDigits = String(data.phone).replace(/\D/g, '');
      const docId = data.id || `REG-2026-${categoryTag}-${phoneDigits}`;

      const payload = {
        ...data,
        id: docId,
        ticketNumber: docId,
        createdAt: serverTimestamp()
      };

      const docRef = doc(serverDb, 'registrations', docId);
      await setDoc(docRef, payload);
      console.log('[Server] Registration saved successfully:', docId);
      res.json({ success: true, id: docId });
    } catch (err: any) {
      console.error('[Server] Registration error:', err);
      res.status(500).json({ error: err?.message || 'Failed to complete registration save' });
    }
  });

  // Programme download statistics
  app.get('/api/stats', async (_, res) => {
    try {
      if (!serverDb) return res.json({ count: 0 });
      const statRef = doc(serverDb, 'stats', 'programmeDownloads');
      const snap = await getDoc(statRef);
      const count = snap.exists() ? (snap.data().count || 0) : 0;
      res.json({ count });
    } catch (e: any) {
      res.json({ count: 0 });
    }
  });

  app.post('/api/stats/download-programme', async (_, res) => {
    try {
      if (!serverDb) return res.json({ success: false });
      const statRef = doc(serverDb, 'stats', 'programmeDownloads');
      await setDoc(statRef, { count: increment(1) }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // Admin registrations retrieval fallback
  app.get('/api/admin/registrations', async (_, res) => {
    try {
      if (!serverDb) return res.json([]);
      const q = query(collection(serverDb, 'registrations'));
      const snapshot = await getDocs(q);
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });
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
