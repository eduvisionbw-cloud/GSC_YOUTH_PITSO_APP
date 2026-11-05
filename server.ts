import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import firebaseAppletConfig from './firebase-applet-config.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const CANONICAL_DATABASE_ID =
  firebaseAppletConfig.firestoreDatabaseId ||
  'ai-studio-gscyouthpitsoapp-cfe0bcb3-77b5-4a4d-b94d-15922db060db';

function getValidConfigValue(envVal: string | undefined, fallbackVal: string): string {
  if (!envVal || envVal.includes('your_') || envVal.trim() === '') {
    return fallbackVal;
  }
  return envVal.trim();
}

function getValidDatabaseId(envVal: string | undefined): string {
  if (
    !envVal ||
    envVal.trim() === '' ||
    envVal.trim().toLowerCase() === 'default' ||
    envVal.trim().toLowerCase() === '(default)' ||
    envVal.trim() === 'undefined' ||
    envVal.includes('your_')
  ) {
    return CANONICAL_DATABASE_ID;
  }
  return envVal.trim();
}

async function startServer() {
  const app = express();
  app.use(express.json());

// Helper to serialize JavaScript objects to Firestore REST JSON fields
function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      fields[key] = { integerValue: String(Math.floor(val)) };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    }
  }
  return fields;
}

// Helper to deserialize Firestore REST JSON fields to standard JavaScript object
function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [key, valObj] of Object.entries(fields)) {
    if (valObj.stringValue !== undefined) obj[key] = valObj.stringValue;
    else if (valObj.integerValue !== undefined) obj[key] = Number(valObj.integerValue);
    else if (valObj.booleanValue !== undefined) obj[key] = valObj.booleanValue;
    else if (valObj.timestampValue !== undefined) obj[key] = valObj.timestampValue;
  }
  return obj;
}

const PORT = process.env.PORT || 3000;

  // Initialize Gemini API if key is available
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // Direct Registration API Route (powered by environment variables/secrets)
  app.post('/api/register', async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.phone || !data.email) {
        return res.status(400).json({ error: 'Missing required registration details' });
      }

      const projectId = getValidConfigValue(process.env.VITE_FIREBASE_PROJECT_ID, firebaseAppletConfig.projectId);
      const fbApiKey = getValidConfigValue(process.env.VITE_FIREBASE_API_KEY, firebaseAppletConfig.apiKey);
      const dbId = getValidDatabaseId(process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID);

      const fields = toFirestoreFields({
        ...data,
        type: data.type || 'individual',
        ward: data.ward || 'Babusi',
        phone: data.phone,
        email: data.email,
        consentGiven: Boolean(data.consentGiven)
      });
      fields.createdAt = { timestampValue: new Date().toISOString() };

      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(dbId)}/documents/registrations?key=${fbApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Firestore REST error (${response.status})`);
      }

      const resDoc = await response.json();
      const docId = resDoc.name ? resDoc.name.split('/').pop() : `REG-${Date.now()}`;

      console.log('[Server] Registration saved successfully to Firestore:', docId);
      res.json({ success: true, id: docId });
    } catch (err: any) {
      console.error('[Server] Registration error:', err);
      res.status(500).json({ error: err?.message || 'Failed to complete registration save' });
    }
  });

  // Programme download statistics
  app.get('/api/stats', async (_, res) => {
    try {
      const projectId = getValidConfigValue(process.env.VITE_FIREBASE_PROJECT_ID, firebaseAppletConfig.projectId);
      const fbApiKey = getValidConfigValue(process.env.VITE_FIREBASE_API_KEY, firebaseAppletConfig.apiKey);
      const dbId = getValidDatabaseId(process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID);

      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(dbId)}/documents/programmeStats/downloads?key=${fbApiKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const rawCount = data.fields?.count?.integerValue ?? data.fields?.count?.doubleValue ?? 0;
        return res.json({ count: Number(rawCount) });
      }
      res.json({ count: 0 });
    } catch (e: any) {
      res.json({ count: 0 });
    }
  });

  app.post('/api/stats/download-programme', async (_, res) => {
    try {
      const projectId = getValidConfigValue(process.env.VITE_FIREBASE_PROJECT_ID, firebaseAppletConfig.projectId);
      const fbApiKey = getValidConfigValue(process.env.VITE_FIREBASE_API_KEY, firebaseAppletConfig.apiKey);
      const dbId = getValidDatabaseId(process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID);

      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(dbId)}/documents/programmeStats/downloads?key=${fbApiKey}`;
      const getRes = await fetch(url);
      let currentCount = 0;
      if (getRes.ok) {
        const docData = await getRes.json();
        currentCount = Number(docData.fields?.count?.integerValue || 0);
      }
      const newCount = currentCount + 1;
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            count: { integerValue: String(newCount) }
          }
        })
      });
      res.json({ success: true, count: newCount });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // Admin registrations retrieval
  app.get('/api/admin/registrations', async (_, res) => {
    try {
      const projectId = getValidConfigValue(process.env.VITE_FIREBASE_PROJECT_ID, firebaseAppletConfig.projectId);
      const fbApiKey = getValidConfigValue(process.env.VITE_FIREBASE_API_KEY, firebaseAppletConfig.apiKey);
      const dbId = getValidDatabaseId(process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID);

      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(dbId)}/documents/registrations?pageSize=100&key=${fbApiKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const list = (data.documents || []).map((doc: any) => {
          const item = fromFirestoreFields(doc.fields || {});
          item.id = doc.name.split('/').pop();
          return item;
        });
        return res.json(list);
      }
      res.json([]);
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
