import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PackingListRequestBody {
  tripName?: string;
  country?: string;
  date?: string;
  days?: number;
  season?: string;
  countrySeasonGuide?: string;
  activities?: string[];
  notes?: string;
}

interface GeneratedPackingItem {
  name: string;
  category: string;
  reason: string;
}

interface GeneratedPackingResponse {
  seasonSummary: string;
  items: GeneratedPackingItem[];
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  const uploadsDir = path.resolve(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use(express.json({ limit: '15mb' }));
  app.use('/uploads', express.static(uploadsDir));

  app.post('/api/uploads', (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        dataUrl?: string;
        filename?: string;
      };
      const dataUrl = String(body.dataUrl || '').trim();
      const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(
        dataUrl
      );
      if (!match) {
        res.status(400).json({ error: 'Please provide a valid JPEG, PNG, WebP, or GIF image.' });
        return;
      }

      const mime = match[1].toLowerCase();
      const base64 = match[2];
      const buffer = Buffer.from(base64, 'base64');
      if (buffer.byteLength === 0 || buffer.byteLength > 8 * 1024 * 1024) {
        res.status(400).json({ error: 'Image size must be under 8 MB.' });
        return;
      }

      const extMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
      };
      const ext = extMap[mime] || 'jpg';
      const safeStem = String(body.filename || 'memory')
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32) || 'memory';
      const uniqueName = `${safeStem}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const targetPath = path.join(uploadsDir, uniqueName);
      fs.writeFileSync(targetPath, buffer);

      res.json({ url: `/uploads/${uniqueName}` });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Failed to save uploaded photo.' });
    }
  });

  app.get('/api/photo-data', async (req: Request, res: Response) => {
    try {
      const rawUrl = String(req.query.url || '').trim();
      if (!rawUrl) {
        res.status(400).json({ error: 'Missing photo URL.' });
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        res.status(400).json({ error: 'Invalid photo URL.' });
        return;
      }

      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        res.status(400).json({ error: 'Only HTTP/HTTPS photo URLs are supported.' });
        return;
      }

      const host = parsed.hostname.toLowerCase();
      const isBlockedHost =
        host === 'localhost' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

      if (isBlockedHost) {
        res.status(403).json({ error: 'Host is not permitted.' });
        return;
      }

      const upstream = await fetch(parsed.toString(), {
        signal: AbortSignal.timeout(10000),
      });

      if (!upstream.ok) {
        res.status(502).json({ error: `Failed to fetch photo (${upstream.status}).` });
        return;
      }

      const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim();
      if (!contentType.startsWith('image/')) {
        res.status(400).json({ error: 'URL did not return an image.' });
        return;
      }

      const arrayBuffer = await upstream.arrayBuffer();
      if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > 8 * 1024 * 1024) {
        res.status(400).json({ error: 'Photo exceeds maximum allowed size (8 MB).' });
        return;
      }

      const base64 = Buffer.from(arrayBuffer).toString('base64');
      res.json({ dataUrl: `data:${contentType};base64,${base64}` });
    } catch (err) {
      console.error('Photo proxy error:', err);
      res.status(502).json({ error: 'Unable to load remote photo for PDF export.' });
    }
  });

  app.post('/api/packing-list', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as PackingListRequestBody;
      const country = String(body.country || '').trim();
      const tripName = String(body.tripName || 'Upcoming Trip').trim();
      const season = String(body.season || '').trim();
      const countrySeasonGuide = String(body.countrySeasonGuide || '').trim();
      const date = String(body.date || '').trim();
      const days = Math.max(1, Math.min(365, Number(body.days) || 5));
      const notes = String(body.notes || '').trim();
      const activities = Array.isArray(body.activities)
        ? body.activities.map((a) => String(a).trim()).filter(Boolean).slice(0, 30)
        : [];

      if (!country) {
        res.status(400).json({ error: 'Destination country is required to generate a packing list.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'Gemini API key is not configured. Please check your environment secrets.',
        });
        return;
      }

      const ai = getGeminiClient();

      const activityLines =
        activities.length > 0
          ? activities.map((act, idx) => `${idx + 1}. ${act}`).join('\n')
          : 'No specific activities added yet — include well-rounded essentials for general sightseeing and local exploration.';

      const prompt = [
        `Create a smart, practical packing list for this trip:`,
        `- Trip Name: ${tripName}`,
        `- Destination: ${country}`,
        `- Travel Date: ${date || 'Flexible'}`,
        `- Duration: ${days} days`,
        `- Destination Season: ${season || 'Seasonal conditions based on travel date'}`,
        countrySeasonGuide ? `- Country Best-Season Guide: ${countrySeasonGuide}` : '',
        notes ? `- Traveler Notes: ${notes}` : '',
        `- Planned Activities:\n${activityLines}`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a thoughtful travel packing planner. Generate a curated, practical packing list of 12 to 18 items tailored specifically to the destination climate/season, trip duration, and planned activities. Avoid generic filler; include quantities where helpful and a concise 4-10 word reason tying each item to the season or a planned activity. Use only these categories: "Clothing", "Footwear", "Gear & Tech", "Toiletries & Health", "Documents & Essentials", "Activity Gear".',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              seasonSummary: {
                type: Type.STRING,
                description:
                  'A friendly 1-sentence summary of the destination weather for this season and overall packing approach.',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: {
                      type: Type.STRING,
                      description: 'Item name with helpful quantity if relevant.',
                    },
                    category: {
                      type: Type.STRING,
                      description:
                        'One of: Clothing, Footwear, Gear & Tech, Toiletries & Health, Documents & Essentials, Activity Gear',
                    },
                    reason: {
                      type: Type.STRING,
                      description: 'Short explanation linking item to the season or planned activity.',
                    },
                  },
                  required: ['name', 'category', 'reason'],
                },
              },
            },
            required: ['seasonSummary', 'items'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty packing list response.' });
        return;
      }

      const parsed = JSON.parse(rawText) as Partial<GeneratedPackingResponse>;
      const items = Array.isArray(parsed.items)
        ? parsed.items
            .filter((item) => item && typeof item.name === 'string' && item.name.trim().length > 0)
            .slice(0, 25)
            .map((item) => ({
              name: item.name.trim().slice(0, 120),
              category: String(item.category || 'Essentials').trim().slice(0, 40),
              reason: String(item.reason || '').trim().slice(0, 140),
            }))
        : [];

      if (items.length === 0) {
        res.status(502).json({ error: 'Could not parse packing items from Gemini response.' });
        return;
      }

      res.json({
        seasonSummary: String(parsed.seasonSummary || '').trim().slice(0, 280),
        items,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate packing list with Gemini.';
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      console.error('Error generating packing list:', err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  app.post('/api/itinerary', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        tripName?: string;
        country?: string;
        date?: string;
        days?: number;
        season?: string;
        countrySeasonGuide?: string;
        places?: string[];
        dest?: string[];
        pace?: string;
        interests?: string;
        notes?: string;
        existingActivities?: string[];
      };

      const country = String(body.country || '').trim();
      const tripName = String(body.tripName || 'Upcoming Trip').trim();
      const date = String(body.date || '').trim();
      const totalDays = Math.max(1, Math.min(365, Number(body.days) || 5));
      const plannedDays = Math.min(totalDays, 14);
      const season = String(body.season || '').trim();
      const countrySeasonGuide = String(body.countrySeasonGuide || '').trim();
      const pace = String(body.pace || 'Balanced').trim();
      const interests = String(body.interests || '').trim();
      const notes = String(body.notes || '').trim();
      const places = Array.isArray(body.places)
        ? body.places.map((p) => String(p).trim()).filter(Boolean).slice(0, 15)
        : [];
      const dest = Array.isArray(body.dest)
        ? body.dest.map((d) => String(d).trim()).filter(Boolean).slice(0, 15)
        : [];
      const existingActivities = Array.isArray(body.existingActivities)
        ? body.existingActivities.map((a) => String(a).trim()).filter(Boolean).slice(0, 20)
        : [];

      if (!country) {
        res.status(400).json({ error: 'Destination country is required to suggest an itinerary.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'Gemini API key is not configured. Please check your environment secrets.',
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        `Design a detailed day-by-day travel itinerary for this trip:`,
        `- Trip Name: ${tripName}`,
        `- Destination Country: ${country}`,
        `- Start Date: ${date || 'Flexible'}`,
        `- Duration: ${totalDays} days (provide structured daily stops for Days 1 to ${plannedDays})`,
        `- Travel Pace: ${pace}`,
        season ? `- Season / Climate Context: ${season}` : '',
        countrySeasonGuide ? `- Best Season Guide: ${countrySeasonGuide}` : '',
        places.length > 0 ? `- Key Cities & Regions: ${places.join(', ')}` : '',
        dest.length > 0 ? `- Notable Sights: ${dest.join(', ')}` : '',
        interests ? `- Traveler Interests & Requests: ${interests}` : '',
        notes ? `- Trip Notes: ${notes}` : '',
        existingActivities.length > 0
          ? `- Existing Activities to keep in mind / complement: ${existingActivities.join('; ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const stopsPerDayHint =
        pace === 'Relaxed'
          ? '2 to 3 unhurried stops per day'
          : pace === 'Packed'
            ? '4 to 5 well-paced stops per day'
            : '3 to 4 realistic stops per day';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: `You are an expert travel concierge and itinerary designer. Create a cohesive, realistic day-by-day itinerary with ${stopsPerDayHint}. Automatically consider real-world travel time and distance when ordering stops each day—group nearby attractions geographically and include realistic travelTimeFromPrev (e.g. "15 mins walk" or "22 mins metro") and distanceFromPrev (e.g. "1.2 km" or "4.5 km") between consecutive stops on the same day. Keep total items <= 65. Use exact day numbers from 1 to ${plannedDays}, clear 12-hour times like "09:00 AM" or "02:30 PM", specific searchable place names and neighborhoods/addresses in location, realistic duration (e.g. "2 hrs"), realistic local currency or USD cost estimates (or "Free"), concise practical tips in details (1–2 sentences), category from ["Sightseeing", "Food & Dining", "Culture & History", "Nature & Outdoors", "Transit & Logistics", "Shopping & Markets", "Relaxation", "Activity"], and placeType from ["attraction", "restaurant", "accommodation", "terminal", "destination", "stop"].`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overview: {
                type: Type.STRING,
                description:
                  'A warm 1–2 sentence overview summarizing the trip route, vibe, and seasonal pacing.',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: {
                      type: Type.INTEGER,
                      description: `Day number between 1 and ${plannedDays}.`,
                    },
                    timeSlot: {
                      type: Type.STRING,
                      description: 'Start time in 12-hour format such as "09:00 AM" or "06:30 PM".',
                    },
                    title: {
                      type: Type.STRING,
                      description: 'Clear, specific activity or landmark stop title.',
                    },
                    location: {
                      type: Type.STRING,
                      description: 'Specific searchable landmark, district, or venue address.',
                    },
                    category: {
                      type: Type.STRING,
                      description:
                        'One of: Sightseeing, Food & Dining, Culture & History, Nature & Outdoors, Transit & Logistics, Shopping & Markets, Relaxation, Activity',
                    },
                    placeType: {
                      type: Type.STRING,
                      description:
                        'One of: attraction, restaurant, accommodation, terminal, destination, stop',
                    },
                    travelTimeFromPrev: {
                      type: Type.STRING,
                      description:
                        'Estimated travel time from previous stop on this day, e.g. "15 mins", or "Start of day".',
                    },
                    distanceFromPrev: {
                      type: Type.STRING,
                      description:
                        'Approximate distance from previous stop on this day, e.g. "1.8 km", or "".',
                    },
                    duration: {
                      type: Type.STRING,
                      description: 'Estimated time spent, e.g. "2 hrs" or "45 mins".',
                    },
                    costEstimate: {
                      type: Type.STRING,
                      description: 'Rough cost per person or "Free".',
                    },
                    details: {
                      type: Type.STRING,
                      description: 'Practical description, tip, or booking advice (1–2 concise sentences).',
                    },
                  },
                  required: [
                    'day',
                    'timeSlot',
                    'title',
                    'location',
                    'category',
                    'duration',
                    'costEstimate',
                    'details',
                  ],
                },
              },
            },
            required: ['overview', 'items'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty itinerary response.' });
        return;
      }

      const VALID_PLACE_TYPES = new Set([
        'destination',
        'attraction',
        'accommodation',
        'restaurant',
        'terminal',
        'stop',
      ]);

      const parsed = JSON.parse(rawText) as {
        overview?: string;
        items?: Array<{
          day?: number;
          timeSlot?: string;
          title?: string;
          location?: string;
          category?: string;
          placeType?: string;
          travelTimeFromPrev?: string;
          distanceFromPrev?: string;
          duration?: string;
          costEstimate?: string;
          details?: string;
        }>;
      };

      const items = Array.isArray(parsed.items)
        ? parsed.items
            .filter((item) => item && typeof item.title === 'string' && item.title.trim().length > 0)
            .slice(0, 70)
            .map((item) => {
              const placeType = VALID_PLACE_TYPES.has(String(item.placeType || '').trim())
                ? String(item.placeType).trim()
                : undefined;
              const travelTimeFromPrev = String(item.travelTimeFromPrev || '').trim().slice(0, 40);
              const distanceFromPrev = String(item.distanceFromPrev || '').trim().slice(0, 40);
              return {
                day: Math.max(1, Math.min(plannedDays, Math.round(Number(item.day) || 1))),
                timeSlot: String(item.timeSlot || '09:00 AM').trim().slice(0, 40),
                title: String(item.title || '').trim().slice(0, 140),
                location: String(item.location || country).trim().slice(0, 120),
                category: String(item.category || 'Sightseeing').trim().slice(0, 40),
                ...(placeType ? { placeType } : {}),
                ...(travelTimeFromPrev ? { travelTimeFromPrev } : {}),
                ...(distanceFromPrev ? { distanceFromPrev } : {}),
                duration: String(item.duration || '2 hrs').trim().slice(0, 40),
                costEstimate: String(item.costEstimate || 'Varies').trim().slice(0, 40),
                details: String(item.details || '').trim().slice(0, 400),
              };
            })
        : [];

      if (items.length === 0) {
        res.status(502).json({ error: 'Could not parse itinerary stops from Gemini response.' });
        return;
      }

      res.json({
        overview: String(parsed.overview || '').trim().slice(0, 900),
        items,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate itinerary with Gemini.';
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      console.error('Error generating itinerary:', err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  // Phase 1: Fast trip outline across all travel days
  app.post('/api/itinerary/outline', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        tripName?: string;
        country?: string;
        date?: string;
        days?: number;
        season?: string;
        places?: string[];
        dest?: string[];
        mode?: string;
        interests?: string;
        notes?: string;
        existingDays?: Array<{ day?: number; titles?: string[] }>;
      };

      const country = String(body.country || '').trim();
      const tripName = String(body.tripName || 'Upcoming Trip').trim();
      const date = String(body.date || '').trim();
      const totalDays = Math.max(1, Math.min(365, Number(body.days) || 5));
      const plannedDays = Math.min(totalDays, 14);
      const mode = String(body.mode || 'Balanced').trim();
      const season = String(body.season || '').trim();
      const interests = String(body.interests || '').trim();
      const notes = String(body.notes || '').trim();
      const places = Array.isArray(body.places)
        ? body.places.map((p) => String(p).trim()).filter(Boolean).slice(0, 10)
        : [];
      const dest = Array.isArray(body.dest)
        ? body.dest.map((d) => String(d).trim()).filter(Boolean).slice(0, 10)
        : [];
      const existingDays = Array.isArray(body.existingDays)
        ? body.existingDays
            .filter((d) => d && Number(d.day) >= 1)
            .slice(0, 14)
            .map((d) => ({
              day: Math.round(Number(d.day)),
              titles: Array.isArray(d.titles)
                ? d.titles.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
                : [],
            }))
        : [];

      if (!country) {
        res.status(400).json({ error: 'Destination country is required to generate an outline.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'Gemini API key is not configured. Please check your environment secrets.',
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        `Trip: "${tripName}" in ${country}, start ${date || 'Flexible'}, ${plannedDays} days, mode: ${mode}.`,
        season ? `Season: ${season}.` : '',
        places.length > 0 ? `Regions: ${places.join(', ')}.` : '',
        dest.length > 0 ? `Sights: ${dest.join(', ')}.` : '',
        interests ? `Interests: ${interests}.` : '',
        notes ? `Notes: ${notes}.` : '',
        existingDays.length > 0
          ? `Already planned days (build smoothly around these): ${existingDays
              .map((d) => `Day ${d.day}: ${d.titles.join(', ')}`)
              .join(' | ')}.`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `Return a fast, cohesive ${plannedDays}-day travel outline for ${country}. Keep overview to 1-2 short sentences. For each day 1..${plannedDays}, return a short theme (3-6 words), a primary area/city, and 2-3 brief highlight keywords. Keep output concise.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overview: {
                type: Type.STRING,
                description: '1-2 concise sentences summarizing the route and pacing.',
              },
              dayOutlines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.INTEGER },
                    theme: { type: Type.STRING },
                    area: { type: Type.STRING },
                    highlights: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['day', 'theme', 'area', 'highlights'],
                },
              },
            },
            required: ['overview', 'dayOutlines'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty outline response.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        overview?: string;
        dayOutlines?: Array<{
          day?: number;
          theme?: string;
          area?: string;
          highlights?: string[];
        }>;
      };

      const outlineMap = new Map<
        number,
        { day: number; theme: string; area: string; highlights: string[] }
      >();

      if (Array.isArray(parsed.dayOutlines)) {
        for (const entry of parsed.dayOutlines) {
          const dayNum = Math.max(1, Math.min(plannedDays, Math.round(Number(entry.day) || 1)));
          if (!outlineMap.has(dayNum)) {
            outlineMap.set(dayNum, {
              day: dayNum,
              theme: String(entry.theme || `Day ${dayNum} Exploration`).trim().slice(0, 100),
              area: String(entry.area || country).trim().slice(0, 80),
              highlights: Array.isArray(entry.highlights)
                ? entry.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 4)
                : [],
            });
          }
        }
      }

      const dayOutlines = Array.from({ length: plannedDays }, (_, i) => {
        const d = i + 1;
        return (
          outlineMap.get(d) || {
            day: d,
            theme: `Day ${d} in ${country}`,
            area: places[i % Math.max(1, places.length)] || country,
            highlights: [],
          }
        );
      });

      res.json({
        overview: String(parsed.overview || '').trim().slice(0, 900),
        dayOutlines,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate itinerary outline.';
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      console.error('Error generating itinerary outline:', err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  // Phase 2: Populate a single day progressively
  app.post('/api/itinerary/day', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        tripName?: string;
        country?: string;
        date?: string;
        day?: number;
        totalDays?: number;
        mode?: string;
        dayOutline?: { theme?: string; area?: string; highlights?: string[] };
        season?: string;
        interests?: string;
        notes?: string;
        avoidTitles?: string[];
      };

      const country = String(body.country || '').trim();
      const tripName = String(body.tripName || 'Upcoming Trip').trim();
      const date = String(body.date || '').trim();
      const totalDays = Math.max(1, Math.min(365, Number(body.totalDays) || 5));
      const dayNum = Math.max(1, Math.min(totalDays, Math.round(Number(body.day) || 1)));
      const mode = String(body.mode || 'Balanced').trim();
      const season = String(body.season || '').trim();
      const interests = String(body.interests || '').trim();
      const notes = String(body.notes || '').trim();
      const theme = String(body.dayOutline?.theme || '').trim();
      const area = String(body.dayOutline?.area || '').trim();
      const highlights = Array.isArray(body.dayOutline?.highlights)
        ? body.dayOutline.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 5)
        : [];
      const avoidTitles = Array.isArray(body.avoidTitles)
        ? body.avoidTitles.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
        : [];

      if (!country) {
        res.status(400).json({ error: 'Destination country is required to generate a day plan.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'Gemini API key is not configured. Please check your environment secrets.',
        });
        return;
      }

      const ai = getGeminiClient();

      const modeConfig =
        mode === 'Quick Plan'
          ? {
              stopInstruction: '2 concise, essential stops (morning and afternoon/evening)',
              detailInstruction: '1 crisp practical sentence per stop.',
              thinkingLevel: ThinkingLevel.LOW,
              maxItems: 3,
            }
          : mode === 'Detailed'
            ? {
                stopInstruction: '4 to 5 well-paced stops spanning morning through evening',
                detailInstruction:
                  '2 helpful sentences with transit tips, timing advice, and specific local food/spot recommendations.',
                thinkingLevel: ThinkingLevel.MEDIUM,
                maxItems: 6,
              }
            : {
                stopInstruction: '3 to 4 balanced stops (highlights + a local meal)',
                detailInstruction: '1–2 practical sentences per stop.',
                thinkingLevel: ThinkingLevel.LOW,
                maxItems: 5,
              };

      const prompt = [
        `Generate Day ${dayNum} of ${totalDays} for "${tripName}" in ${country}.`,
        date ? `Trip start: ${date}.` : '',
        season ? `Season: ${season}.` : '',
        theme ? `Day theme: ${theme}.` : '',
        area ? `Focus area: ${area}.` : '',
        highlights.length > 0 ? `Key highlights: ${highlights.join(', ')}.` : '',
        interests ? `Traveler interests: ${interests}.` : '',
        notes ? `Notes: ${notes}.` : '',
        avoidTitles.length > 0 ? `Do not repeat: ${avoidTitles.join('; ')}.` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: modeConfig.thinkingLevel },
          systemInstruction: `You are an expert travel planner. Output ${modeConfig.stopInstruction} for Day ${dayNum} only, ordered chronologically with nearby locations to minimize travel time and distance (avoid unnecessary backtracking across the city). Space timeSlots realistically for transit between stops, and include travelTimeFromPrev (e.g. "18 mins train") and distanceFromPrev (e.g. "3.4 km") for stops after the first stop. Use 12-hour times ("09:00 AM"), specific searchable place names/neighborhoods in location, realistic duration ("2 hrs"), brief cost estimate (local currency or "Free"), ${modeConfig.detailInstruction} Category must be one of: "Sightseeing", "Food & Dining", "Culture & History", "Nature & Outdoors", "Transit & Logistics", "Shopping & Markets", "Relaxation", "Activity". placeType must be one of: "attraction", "restaurant", "accommodation", "terminal", "destination", "stop".`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timeSlot: { type: Type.STRING },
                    title: { type: Type.STRING },
                    location: { type: Type.STRING },
                    category: { type: Type.STRING },
                    placeType: { type: Type.STRING },
                    travelTimeFromPrev: { type: Type.STRING },
                    distanceFromPrev: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    costEstimate: { type: Type.STRING },
                    details: { type: Type.STRING },
                  },
                  required: [
                    'timeSlot',
                    'title',
                    'location',
                    'category',
                    'duration',
                    'costEstimate',
                    'details',
                  ],
                },
              },
            },
            required: ['items'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: `Gemini returned an empty response for Day ${dayNum}.` });
        return;
      }

      const VALID_PLACE_TYPES = new Set([
        'destination',
        'attraction',
        'accommodation',
        'restaurant',
        'terminal',
        'stop',
      ]);

      const parsed = JSON.parse(rawText) as {
        items?: Array<{
          timeSlot?: string;
          title?: string;
          location?: string;
          category?: string;
          placeType?: string;
          travelTimeFromPrev?: string;
          distanceFromPrev?: string;
          duration?: string;
          costEstimate?: string;
          details?: string;
        }>;
      };

      const items = Array.isArray(parsed.items)
        ? parsed.items
            .filter((item) => item && typeof item.title === 'string' && item.title.trim().length > 0)
            .slice(0, modeConfig.maxItems)
            .map((item) => {
              const placeType = VALID_PLACE_TYPES.has(String(item.placeType || '').trim())
                ? String(item.placeType).trim()
                : undefined;
              const travelTimeFromPrev = String(item.travelTimeFromPrev || '').trim().slice(0, 40);
              const distanceFromPrev = String(item.distanceFromPrev || '').trim().slice(0, 40);
              return {
                day: dayNum,
                timeSlot: String(item.timeSlot || '09:00 AM').trim().slice(0, 40),
                title: String(item.title || '').trim().slice(0, 140),
                location: String(item.location || area || country).trim().slice(0, 120),
                category: String(item.category || 'Sightseeing').trim().slice(0, 40),
                ...(placeType ? { placeType } : {}),
                ...(travelTimeFromPrev ? { travelTimeFromPrev } : {}),
                ...(distanceFromPrev ? { distanceFromPrev } : {}),
                duration: String(item.duration || '2 hrs').trim().slice(0, 40),
                costEstimate: String(item.costEstimate || 'Varies').trim().slice(0, 40),
                details: String(item.details || '').trim().slice(0, 400),
              };
            })
        : [];

      if (items.length === 0) {
        res.status(502).json({ error: `Could not generate stops for Day ${dayNum}.` });
        return;
      }

      res.json({ day: dayNum, items });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate day itinerary with Gemini.';
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      console.error('Error generating itinerary day:', err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  app.post('/api/budget-estimate', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        country?: string;
        destination?: string;
        travelDate?: string;
        days?: number;
        travelers?: number;
        preference?: string;
        currency?: string;
        plannedActivities?: string[];
        notes?: string;
      };

      const country = String(body.country || '').trim();
      const destination = String(body.destination || '').trim();
      const travelDate = String(body.travelDate || '').trim();
      const days = Math.max(1, Math.min(365, Math.round(Number(body.days) || 5)));
      const travelers = Math.max(1, Math.min(50, Math.round(Number(body.travelers) || 1)));
      const preference = String(body.preference || 'Mid-range / Balanced').trim();
      const currency = String(body.currency || 'PHP').trim() || 'PHP';
      const notes = String(body.notes || '').trim();
      const plannedActivities = Array.isArray(body.plannedActivities)
        ? body.plannedActivities.map((a) => String(a).trim()).filter(Boolean).slice(0, 20)
        : [];

      if (!country) {
        res.status(400).json({ error: 'Destination country is required to generate a budget estimate.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'Gemini API key is not configured. Please check your environment secrets.',
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        `Estimate the total trip budget in ${currency} (Philippine Peso if PHP) for this travel plan:`,
        `- Country: ${country}`,
        destination ? `- Specific Cities / Destination: ${destination}` : '',
        `- Travel Start Date / Season: ${travelDate || 'Flexible'}`,
        `- Duration: ${days} days (${Math.max(1, days - 1)} nights where applicable)`,
        `- Travelers: ${travelers} ${travelers === 1 ? 'person' : 'people'}`,
        `- Budget Style Preference: ${preference}`,
        plannedActivities.length > 0
          ? `- Planned Trip Activities: ${plannedActivities.join('; ')}`
          : '',
        notes ? `- Traveler Preferences / Notes: ${notes}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: `You are an experienced travel budget planner. Calculate realistic whole-number total trip estimates in ${currency} across 5 exact categories: transportation (flights, trains, airport transfers, local transit), accommodation (total nights for the group), food (daily meals, snacks, cafes), activities (tickets, tours, excursions), and other (travel insurance, SIM/eSIM, buffer, tips). Factor in seasonal pricing around the travel date, number of days, number of travelers, and the selected budget preference (${preference}). Also write 2-3 concise practical budget tips and cost assumptions in notes.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description:
                  'Concise title for this budget estimate, e.g. "5-Day Tokyo Winter Balance Plan".',
              },
              breakdown: {
                type: Type.OBJECT,
                properties: {
                  transportation: {
                    type: Type.NUMBER,
                    description: `Estimated total transportation cost in ${currency} (whole number >= 0).`,
                  },
                  accommodation: {
                    type: Type.NUMBER,
                    description: `Estimated total accommodation cost in ${currency} (whole number >= 0).`,
                  },
                  food: {
                    type: Type.NUMBER,
                    description: `Estimated total food and dining cost in ${currency} (whole number >= 0).`,
                  },
                  activities: {
                    type: Type.NUMBER,
                    description: `Estimated total activities and entry fees cost in ${currency} (whole number >= 0).`,
                  },
                  other: {
                    type: Type.NUMBER,
                    description: `Estimated miscellaneous, connectivity, and contingency cost in ${currency} (whole number >= 0).`,
                  },
                },
                required: ['transportation', 'accommodation', 'food', 'activities', 'other'],
              },
              notes: {
                type: Type.STRING,
                description:
                  '2-3 practical sentences explaining seasonal rates, transit assumptions, and ways to save.',
              },
            },
            required: ['title', 'breakdown', 'notes'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty budget estimate response.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        title?: string;
        breakdown?: Partial<Record<'transportation' | 'accommodation' | 'food' | 'activities' | 'other', number>>;
        notes?: string;
      };

      const rawBreakdown = parsed.breakdown;
      if (!rawBreakdown || typeof rawBreakdown !== 'object') {
        res.status(502).json({ error: 'Could not parse budget breakdown from Gemini response.' });
        return;
      }

      const toWholeAmount = (val: unknown) => {
        const n = Number(val);
        if (!Number.isFinite(n) || n < 0) return 0;
        return Math.min(1000000000, Math.round(n));
      };

      res.json({
        title: String(parsed.title || `${destination || country} Budget Plan`)
          .trim()
          .slice(0, 140),
        breakdown: {
          transportation: toWholeAmount(rawBreakdown.transportation),
          accommodation: toWholeAmount(rawBreakdown.accommodation),
          food: toWholeAmount(rawBreakdown.food),
          activities: toWholeAmount(rawBreakdown.activities),
          other: toWholeAmount(rawBreakdown.other),
        },
        notes: String(parsed.notes || '').trim().slice(0, 1200),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate budget estimate with Gemini.';
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      console.error('Error generating budget estimate:', err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  const extractGeminiError = (err: unknown, fallback: string): string => {
    const raw = err instanceof Error ? err.message : fallback;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed?.error?.message) return parsed.error.message;
    } catch {
      // Plain text error message
    }
    return raw || fallback;
  };

  const VALID_TRANSPORT_MODES = new Set([
    'Train',
    'Bus',
    'Ferry',
    'Taxi',
    'Ride-Hailing',
    'Local Transit',
    'Multi-Modal',
  ]);

  const sanitizeHttpUrl = (raw: unknown): string | undefined => {
    const val = String(raw || '').trim();
    if (!val) return undefined;
    try {
      const parsed = new URL(val);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.toString().slice(0, 500);
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  const extractGroundedLinks = (
    response: {
      candidates?: Array<{
        groundingMetadata?: {
          groundingChunks?: Array<{
            web?: { uri?: string; title?: string };
          }>;
        };
      }>;
    },
    modelLinks?: Array<{ title?: string; url?: string }>
  ) => {
    const seen = new Set<string>();
    const combined: Array<{ title: string; url: string }> = [];

    const pushLink = (titleRaw: unknown, urlRaw: unknown) => {
      const url = sanitizeHttpUrl(urlRaw);
      if (!url || seen.has(url)) return;
      seen.add(url);
      combined.push({
        title: String(titleRaw || 'Transit source').trim().slice(0, 120) || 'Transit source',
        url,
      });
    };

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        if (chunk?.web?.uri) {
          pushLink(chunk.web.title || 'Web source', chunk.web.uri);
        }
      }
    }

    if (Array.isArray(modelLinks)) {
      for (const l of modelLinks) {
        if (l) pushLink(l.title, l.url);
      }
    }

    return combined.slice(0, 10);
  };

  const stripCodeFences = (raw: string) =>
    raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

  async function generateGroundedJson<T>(
    ai: GoogleGenAI,
    prompt: string,
    systemInstruction: string,
    responseSchema: Record<string, unknown>
  ): Promise<{
    parsed: T;
    groundedLinks: Array<{ title: string; url: string }>;
    hasWebGrounding: boolean;
  }> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ googleSearch: {} }],
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      const rawText = stripCodeFences(response.text ?? '');
      if (rawText) {
        const parsed = JSON.parse(rawText) as T;
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        return {
          parsed,
          groundedLinks: extractGroundedLinks(response),
          hasWebGrounding: chunks.some((c) => Boolean(c?.web?.uri)),
        };
      }
    } catch (firstErr) {
      const status =
        typeof (firstErr as { status?: unknown })?.status === 'number'
          ? (firstErr as { status: number }).status
          : 0;
      const isParseOrSchemaError =
        firstErr instanceof SyntaxError ||
        status === 400 ||
        /schema|mime|JSON|INVALID_ARGUMENT/i.test(
          firstErr instanceof Error ? firstErr.message : ''
        );
      if (!isParseOrSchemaError) {
        throw firstErr;
      }
    }

    const fallbackResp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        tools: [{ googleSearch: {} }],
        systemInstruction: `${systemInstruction}\nCRITICAL: Respond strictly with a single valid JSON object matching the requested fields. Do not include markdown prose outside the JSON.`,
      },
    });
    const rawText = stripCodeFences(fallbackResp.text ?? '');
    if (!rawText) {
      throw new Error('Gemini returned an empty transportation response.');
    }
    const jsonMatch = /\{[\s\S]*\}/.exec(rawText);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText) as T;
    const chunks = fallbackResp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return {
      parsed,
      groundedLinks: extractGroundedLinks(fallbackResp),
      hasWebGrounding: chunks.some((c) => Boolean(c?.web?.uri)),
    };
  }

  app.post('/api/transport/guide', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        country?: string;
        city?: string;
        origin?: string;
        destination?: string;
        preferredMode?: string;
        travelPriority?: string;
        travelers?: number;
        notes?: string;
      };

      const country = String(body.country || '').trim();
      const city = String(body.city || '').trim();
      const origin = String(body.origin || '').trim();
      const destination = String(body.destination || '').trim();
      const preferredMode = String(body.preferredMode || 'All').trim();
      const travelPriority = String(body.travelPriority || 'Balanced').trim();
      const travelers = Math.max(1, Math.min(20, Math.round(Number(body.travelers) || 1)));
      const notes = String(body.notes || '').trim();

      if (!country || !origin || !destination) {
        res.status(400).json({
          error: 'Country, origin, and destination are required to build a transportation guide.',
        });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'Gemini API key is not configured. Please check your environment secrets.',
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        `Build a practical, accurate worldwide Transportation Guide and route recommendations for:`,
        `- Country: ${country}`,
        city ? `- Primary City / Region: ${city}` : '',
        `- Route Origin: ${origin}`,
        `- Route Destination: ${destination}`,
        `- Preferred Mode Filter: ${preferredMode}`,
        `- Traveler Priority: ${travelPriority}`,
        `- Travelers: ${travelers}`,
        notes ? `- Extra Context / Luggage / Accessibility Notes: ${notes}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const systemInstruction = `You are a worldwide transit & mobility specialist. Use Google Search to verify official transport operators, train/bus/ferry lines, schedules, fares, and ticketing portals.
Return JSON with two keys: "cityGuide" and "routes".
1) "cityGuide": overview of local transport for ${city || country} (${country}), specifically covering: transitCardOrPass, buses, trainsAndMetro, ferries (explain harbor/island routes or state "Not applicable / inland city" if none), taxisAndRideHailing (include exact local apps like Uber, Grab, Bolt, GO, Kakao T, Didi, FreeNow etc.), summary, localTips (array of 3-4 practical tips), and sourceLinks (official transit agency URLs).
2) "routes": 3 to 4 distinct practical options connecting "${origin}" to "${destination}" covering relevant modes among ["Train", "Bus", "Ferry", "Taxi", "Ride-Hailing", "Local Transit", "Multi-Modal"] (prioritize "${preferredMode}" if not "All", while still keeping practical alternatives).
For EACH route provide:
- mode (exact enum from the 7 above)
- operator (real transit operator or ride-hailing/taxi provider names)
- departurePoint & arrivalPoint (exact station, pier, bus terminal, or pickup zone)
- duration (e.g. "45 mins" or "2h 15m")
- fareLocal (accurate fare in local currency e.g. "¥1,500" or "€18–€24")
- estimatedPhpFare (whole-number equivalent in Philippine Peso PHP for ${travelers} traveler(s) so it syncs to the PHP trip budget tracker)
- schedule (operating hours & frequency e.g. "Every 10 mins, 05:30 AM – 11:45 PM")
- bookingUrl (official operator or booking URL starting with https:// if known, else "")
- verificationStatus: "verified" ONLY when operator, route, and typical fare/schedule are backed by official published transit sources found via search; "estimated" when approximate, dynamic (like metered taxi / surge ride-hailing), or when live timetables vary.
- verificationNote: brief 1-sentence note explaining what is confirmed vs estimated before booking.
- steps: 2 to 5 chronological step-by-step instructions with stepNumber, mode, instruction, terminalOrStation, duration, and lastMileTip (e.g. walking exit, shuttle, or local taxi/bus for the final leg).
- sourceLinks: array of { title, url } official confirmation links.`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          cityGuide: {
            type: Type.OBJECT,
            properties: {
              city: { type: Type.STRING },
              country: { type: Type.STRING },
              summary: { type: Type.STRING },
              transitCardOrPass: { type: Type.STRING },
              buses: { type: Type.STRING },
              trainsAndMetro: { type: Type.STRING },
              ferries: { type: Type.STRING },
              taxisAndRideHailing: { type: Type.STRING },
              localTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              sourceLinks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    url: { type: Type.STRING },
                  },
                  required: ['title', 'url'],
                },
              },
            },
            required: [
              'city',
              'country',
              'summary',
              'transitCardOrPass',
              'buses',
              'trainsAndMetro',
              'ferries',
              'taxisAndRideHailing',
              'localTips',
            ],
          },
          routes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                mode: { type: Type.STRING },
                operator: { type: Type.STRING },
                departurePoint: { type: Type.STRING },
                arrivalPoint: { type: Type.STRING },
                duration: { type: Type.STRING },
                fareLocal: { type: Type.STRING },
                estimatedPhpFare: { type: Type.NUMBER },
                schedule: { type: Type.STRING },
                bookingUrl: { type: Type.STRING },
                verificationStatus: { type: Type.STRING },
                verificationNote: { type: Type.STRING },
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepNumber: { type: Type.INTEGER },
                      mode: { type: Type.STRING },
                      instruction: { type: Type.STRING },
                      terminalOrStation: { type: Type.STRING },
                      duration: { type: Type.STRING },
                      lastMileTip: { type: Type.STRING },
                    },
                    required: ['stepNumber', 'mode', 'instruction'],
                  },
                },
                sourceLinks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      url: { type: Type.STRING },
                    },
                    required: ['title', 'url'],
                  },
                },
              },
              required: [
                'mode',
                'operator',
                'departurePoint',
                'arrivalPoint',
                'duration',
                'fareLocal',
                'estimatedPhpFare',
                'schedule',
                'verificationStatus',
                'verificationNote',
                'steps',
              ],
            },
          },
        },
        required: ['cityGuide', 'routes'],
      };

      interface RawRoute {
        mode?: string;
        operator?: string;
        departurePoint?: string;
        arrivalPoint?: string;
        duration?: string;
        fareLocal?: string;
        estimatedPhpFare?: number;
        schedule?: string;
        bookingUrl?: string;
        verificationStatus?: string;
        verificationNote?: string;
        steps?: Array<{
          stepNumber?: number;
          mode?: string;
          instruction?: string;
          terminalOrStation?: string;
          duration?: string;
          lastMileTip?: string;
        }>;
        sourceLinks?: Array<{ title?: string; url?: string }>;
      }

      interface RawGuideResponse {
        cityGuide?: {
          city?: string;
          country?: string;
          summary?: string;
          transitCardOrPass?: string;
          buses?: string;
          trainsAndMetro?: string;
          ferries?: string;
          taxisAndRideHailing?: string;
          localTips?: string[];
          sourceLinks?: Array<{ title?: string; url?: string }>;
        };
        routes?: RawRoute[];
      }

      const { parsed, groundedLinks, hasWebGrounding } =
        await generateGroundedJson<RawGuideResponse>(ai, prompt, systemInstruction, schema);

      const rawRoutes = Array.isArray(parsed.routes) ? parsed.routes : [];
      if (rawRoutes.length === 0) {
        res.status(502).json({ error: 'Could not find transportation routes for that corridor.' });
        return;
      }

      const stamp = Date.now();
      const routes = rawRoutes.slice(0, 6).map((r, idx) => {
        const mode = VALID_TRANSPORT_MODES.has(String(r.mode || '').trim())
          ? String(r.mode).trim()
          : 'Multi-Modal';
        const bookingUrl = sanitizeHttpUrl(r.bookingUrl);
        const mergedSources = extractGroundedLinks(
          { candidates: [{ groundingMetadata: { groundingChunks: [] } }] },
          [...(Array.isArray(r.sourceLinks) ? r.sourceLinks : []), ...groundedLinks]
        );
        const hasDynamicMode = mode === 'Taxi' || mode === 'Ride-Hailing';
        const verifiedByModel =
          String(r.verificationStatus || '').toLowerCase() === 'verified' &&
          !hasDynamicMode &&
          (hasWebGrounding || mergedSources.length > 0);

        return {
          id: `route-${stamp}-${idx}`,
          country: country.slice(0, 80),
          city: (city || country).slice(0, 100),
          origin: origin.slice(0, 140),
          destination: destination.slice(0, 140),
          mode,
          operator: String(r.operator || 'Local Operator').trim().slice(0, 120),
          departurePoint: String(r.departurePoint || origin).trim().slice(0, 140),
          arrivalPoint: String(r.arrivalPoint || destination).trim().slice(0, 140),
          duration: String(r.duration || 'Varies').trim().slice(0, 60),
          fareLocal: String(r.fareLocal || 'Check operator').trim().slice(0, 80),
          estimatedPhpFare: Math.max(
            0,
            Math.min(1000000000, Math.round(Number(r.estimatedPhpFare) || 0))
          ),
          schedule: String(r.schedule || 'Check daily departures').trim().slice(0, 180),
          ...(bookingUrl ? { bookingUrl } : {}),
          verificationStatus: verifiedByModel ? 'verified' : 'estimated',
          verificationNote: String(
            r.verificationNote ||
              (verifiedByModel
                ? 'Cross-checked against search sources; verify live times before departure.'
                : 'Estimated fare & travel time; metered rates or seasonal timetables may vary.')
          )
            .trim()
            .slice(0, 240),
          steps: Array.isArray(r.steps)
            ? r.steps.slice(0, 10).map((s, sIdx) => ({
                stepNumber: Math.max(1, Math.round(Number(s.stepNumber) || sIdx + 1)),
                mode: String(s.mode || mode).trim().slice(0, 40),
                instruction: String(s.instruction || 'Proceed to boarding area')
                  .trim()
                  .slice(0, 280),
                ...(s.terminalOrStation?.trim()
                  ? { terminalOrStation: s.terminalOrStation.trim().slice(0, 120) }
                  : {}),
                ...(s.duration?.trim() ? { duration: s.duration.trim().slice(0, 40) } : {}),
                ...(s.lastMileTip?.trim()
                  ? { lastMileTip: s.lastMileTip.trim().slice(0, 200) }
                  : {}),
              }))
            : [],
          sourceLinks: mergedSources,
        };
      });

      const cg = parsed.cityGuide || {};
      const citySourceLinks = extractGroundedLinks(
        { candidates: [{ groundingMetadata: { groundingChunks: [] } }] },
        [...(Array.isArray(cg.sourceLinks) ? cg.sourceLinks : []), ...groundedLinks]
      );

      res.json({
        cityGuide: {
          city: String(cg.city || city || country).trim().slice(0, 100),
          country: String(cg.country || country).trim().slice(0, 80),
          summary: String(cg.summary || '').trim().slice(0, 600),
          transitCardOrPass: String(cg.transitCardOrPass || '').trim().slice(0, 320),
          buses: String(cg.buses || '').trim().slice(0, 320),
          trainsAndMetro: String(cg.trainsAndMetro || '').trim().slice(0, 320),
          ferries: String(cg.ferries || 'Not applicable / inland area').trim().slice(0, 320),
          taxisAndRideHailing: String(cg.taxisAndRideHailing || '').trim().slice(0, 320),
          localTips: Array.isArray(cg.localTips)
            ? cg.localTips.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
            : [],
          sourceLinks: citySourceLinks,
        },
        routes,
      });
    } catch (err: unknown) {
      const message = extractGeminiError(
        err,
        'Failed to generate transportation guide with Gemini.'
      );
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      console.error('Error generating transportation guide:', err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  app.post('/api/transport/transfer', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        country?: string;
        day?: number;
        fromActivityId?: string;
        toActivityId?: string;
        fromTitle?: string;
        fromLocation?: string;
        toTitle?: string;
        toLocation?: string;
        date?: string;
      };

      const country = String(body.country || '').trim();
      const day = Math.max(1, Math.min(365, Math.round(Number(body.day) || 1)));
      const fromActivityId = String(body.fromActivityId || '').trim();
      const toActivityId = String(body.toActivityId || '').trim();
      const fromTitle = String(body.fromTitle || '').trim();
      const fromLocation = String(body.fromLocation || '').trim();
      const toTitle = String(body.toTitle || '').trim();
      const toLocation = String(body.toLocation || '').trim();
      const date = String(body.date || '').trim();

      const fromLabel = fromLocation ? `${fromTitle} (${fromLocation})` : fromTitle;
      const toLabel = toLocation ? `${toTitle} (${toLocation})` : toTitle;

      if (!country || !fromTitle || !toTitle) {
        res.status(400).json({
          error: 'Country, origin stop, and destination stop are required to suggest a transfer.',
        });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'Gemini API key is not configured. Please check your environment secrets.',
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        `A traveler has two stops scheduled on Day ${day} in ${country}${date ? ` (${date})` : ''}:`,
        `- From Stop A: ${fromLabel}`,
        `- To Stop B: ${toLabel}`,
        `Suggest the most convenient, affordable, and realistic point-to-point transport between Stop A and Stop B, including step-by-step stations/stops, transfers, and last-mile directions.`,
      ].join('\n');

      const systemInstruction = `You are a smart travel transit concierge. Use Google Search when needed to confirm transit lines, operators, or ferries between two itinerary stops in ${country}.
Return a JSON object with:
- recommendedMode: one of ["Train", "Bus", "Ferry", "Taxi", "Ride-Hailing", "Local Transit", "Multi-Modal"]
- operator: specific transit agency, line name, or ride-hailing service (e.g. "Tokyo Metro Ginza Line", "Grab / Metered Taxi", "JR Tokaido Shinkansen")
- departurePoint & arrivalPoint: exact station, stop, pier, or pickup landmark
- duration: realistic travel duration (e.g. "22 mins")
- fareLocal: fare in local currency (e.g. "¥210" or "€1.90")
- estimatedPhpFare: whole-number Philippine Peso (PHP) cost per person for automatic budget tracking
- schedule: service frequency or operating hours
- bookingUrl: official booking/agency URL if applicable (else "")
- verificationStatus: "verified" if specific transit line/fare is confirmed via search sources, or "estimated" if dynamic/approximate (taxis, ride-hailing, variable ferries)
- verificationNote: 1 short sentence clarifying verified vs estimated status
- summary: 1 crisp sentence explaining the best way to travel from Stop A to Stop B, how long it takes, and cost
- steps: 2 to 4 chronological steps with stepNumber, mode, instruction, terminalOrStation, duration, and lastMileTip
- sourceLinks: array of { title, url } to confirm details`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          recommendedMode: { type: Type.STRING },
          operator: { type: Type.STRING },
          departurePoint: { type: Type.STRING },
          arrivalPoint: { type: Type.STRING },
          duration: { type: Type.STRING },
          fareLocal: { type: Type.STRING },
          estimatedPhpFare: { type: Type.NUMBER },
          schedule: { type: Type.STRING },
          bookingUrl: { type: Type.STRING },
          verificationStatus: { type: Type.STRING },
          verificationNote: { type: Type.STRING },
          summary: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stepNumber: { type: Type.INTEGER },
                mode: { type: Type.STRING },
                instruction: { type: Type.STRING },
                terminalOrStation: { type: Type.STRING },
                duration: { type: Type.STRING },
                lastMileTip: { type: Type.STRING },
              },
              required: ['stepNumber', 'mode', 'instruction'],
            },
          },
          sourceLinks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                url: { type: Type.STRING },
              },
              required: ['title', 'url'],
            },
          },
        },
        required: [
          'recommendedMode',
          'operator',
          'departurePoint',
          'arrivalPoint',
          'duration',
          'fareLocal',
          'estimatedPhpFare',
          'schedule',
          'verificationStatus',
          'verificationNote',
          'summary',
          'steps',
        ],
      };

      interface RawTransfer {
        recommendedMode?: string;
        operator?: string;
        departurePoint?: string;
        arrivalPoint?: string;
        duration?: string;
        fareLocal?: string;
        estimatedPhpFare?: number;
        schedule?: string;
        bookingUrl?: string;
        verificationStatus?: string;
        verificationNote?: string;
        summary?: string;
        steps?: Array<{
          stepNumber?: number;
          mode?: string;
          instruction?: string;
          terminalOrStation?: string;
          duration?: string;
          lastMileTip?: string;
        }>;
        sourceLinks?: Array<{ title?: string; url?: string }>;
      }

      const { parsed, groundedLinks, hasWebGrounding } =
        await generateGroundedJson<RawTransfer>(ai, prompt, systemInstruction, schema);

      const recommendedMode = VALID_TRANSPORT_MODES.has(
        String(parsed.recommendedMode || '').trim()
      )
        ? String(parsed.recommendedMode).trim()
        : 'Local Transit';

      const mergedSources = extractGroundedLinks(
        { candidates: [{ groundingMetadata: { groundingChunks: [] } }] },
        [...(Array.isArray(parsed.sourceLinks) ? parsed.sourceLinks : []), ...groundedLinks]
      );
      const bookingUrl = sanitizeHttpUrl(parsed.bookingUrl);
      const hasDynamicMode =
        recommendedMode === 'Taxi' || recommendedMode === 'Ride-Hailing';
      const verifiedByModel =
        String(parsed.verificationStatus || '').toLowerCase() === 'verified' &&
        !hasDynamicMode &&
        (hasWebGrounding || mergedSources.length > 0);

      res.json({
        day,
        fromActivityId,
        toActivityId,
        fromLabel: fromLabel.slice(0, 140),
        toLabel: toLabel.slice(0, 140),
        recommendedMode,
        operator: String(parsed.operator || 'Local Transit').trim().slice(0, 120),
        departurePoint: String(parsed.departurePoint || fromLabel).trim().slice(0, 140),
        arrivalPoint: String(parsed.arrivalPoint || toLabel).trim().slice(0, 140),
        duration: String(parsed.duration || '20–30 mins').trim().slice(0, 60),
        fareLocal: String(parsed.fareLocal || 'Varies').trim().slice(0, 80),
        estimatedPhpFare: Math.max(
          0,
          Math.min(1000000000, Math.round(Number(parsed.estimatedPhpFare) || 0))
        ),
        schedule: String(parsed.schedule || 'Runs throughout the day').trim().slice(0, 180),
        ...(bookingUrl ? { bookingUrl } : {}),
        verificationStatus: verifiedByModel ? 'verified' : 'estimated',
        verificationNote: String(
          parsed.verificationNote ||
            (verifiedByModel
              ? 'Route & operator matched with search sources; confirm live departures.'
              : 'Estimated point-to-point transit duration and fare.')
        )
          .trim()
          .slice(0, 240),
        summary: String(parsed.summary || '').trim().slice(0, 360),
        steps: Array.isArray(parsed.steps)
          ? parsed.steps.slice(0, 8).map((s, idx) => ({
              stepNumber: Math.max(1, Math.round(Number(s.stepNumber) || idx + 1)),
              mode: String(s.mode || recommendedMode).trim().slice(0, 40),
              instruction: String(s.instruction || 'Follow transit directions')
                .trim()
                .slice(0, 280),
              ...(s.terminalOrStation?.trim()
                ? { terminalOrStation: s.terminalOrStation.trim().slice(0, 120) }
                : {}),
              ...(s.duration?.trim() ? { duration: s.duration.trim().slice(0, 40) } : {}),
              ...(s.lastMileTip?.trim()
                ? { lastMileTip: s.lastMileTip.trim().slice(0, 200) }
                : {}),
            }))
          : [],
        sourceLinks: mergedSources,
      });
    } catch (err: unknown) {
      const message = extractGeminiError(
        err,
        'Failed to suggest itinerary transfer.'
      );
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      console.error('Error generating transfer suggestion:', err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  // Google Maps Platform configuration & server proxies (Places API New + Routes API)
  const getMapsApiKey = (): string =>
    (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();

  const haversineMeters = (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
  ): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sin1 = Math.sin(dLat / 2);
    const sin2 = Math.sin(dLng / 2);
    const h =
      sin1 * sin1 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sin2 * sin2;
    return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  };

  const formatDurationSec = (sec: number): string => {
    if (!Number.isFinite(sec) || sec <= 0) return '1 min';
    const mins = Math.max(1, Math.round(sec / 60));
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} hr ${rem} min${rem === 1 ? '' : 's'}` : `${hrs} hr${hrs === 1 ? '' : 's'}`;
  };

  const formatDistanceM = (meters: number): string => {
    if (!Number.isFinite(meters) || meters <= 0) return '—';
    if (meters < 1000) return `${Math.round(meters)} m`;
    const km = meters / 1000;
    return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  };

  const parseDurationSeconds = (raw?: string): number => {
    if (!raw) return 0;
    const match = /^(\d+(?:\.\d+)?)s$/.exec(String(raw).trim());
    return match ? Math.round(Number(match[1])) : 0;
  };

  const isMapsQuotaErrorPayload = (status: number, payload: unknown): boolean => {
    if (status === 429) return true;
    const err = (payload as { error?: { status?: string; message?: string } })?.error;
    if (!err) return false;
    return (
      err.status === 'RESOURCE_EXHAUSTED' ||
      /quota|rate limit|RESOURCE_EXHAUSTED/i.test(String(err.message || ''))
    );
  };

  const isMapsReferrerBlockedPayload = (status: number, payload: unknown): boolean => {
    if (status !== 403) return false;
    const err = (payload as { error?: { message?: string; details?: Array<{ reason?: string }> } })
      ?.error;
    const reasonHit = Array.isArray(err?.details)
      ? err.details.some((d) => /REFERRER|REFERER|BLOCKED/i.test(String(d?.reason || '')))
      : false;
    return reasonHit || /referer|referrer|HTTP referrer/i.test(String(err?.message || ''));
  };

  const inferStopTypeFromPlace = (
    explicitType: string | undefined,
    category: string | undefined,
    types: string[] = []
  ): 'destination' | 'attraction' | 'accommodation' | 'restaurant' | 'terminal' | 'stop' => {
    const valid = new Set([
      'destination',
      'attraction',
      'accommodation',
      'restaurant',
      'terminal',
      'stop',
    ]);
    if (explicitType && valid.has(explicitType)) {
      return explicitType as 'destination' | 'attraction' | 'accommodation' | 'restaurant' | 'terminal' | 'stop';
    }
    const lowerCat = (category || '').toLowerCase();
    if (types.some((t) => ['lodging', 'hotel', 'hostel', 'resort_hotel', 'bed_and_breakfast'].includes(t))) {
      return 'accommodation';
    }
    if (
      types.some((t) =>
        ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway', 'coffee_shop'].includes(t)
      ) ||
      lowerCat.includes('food')
    ) {
      return 'restaurant';
    }
    if (
      types.some((t) =>
        [
          'airport',
          'train_station',
          'subway_station',
          'bus_station',
          'ferry_terminal',
          'transit_station',
        ].includes(t)
      ) ||
      lowerCat.includes('transit')
    ) {
      return 'terminal';
    }
    if (
      types.some((t) =>
        [
          'tourist_attraction',
          'museum',
          'park',
          'historical_landmark',
          'national_park',
          'art_gallery',
          'amusement_park',
        ].includes(t)
      ) ||
      lowerCat.includes('sight') ||
      lowerCat.includes('culture') ||
      lowerCat.includes('nature')
    ) {
      return 'attraction';
    }
    if (types.some((t) => ['locality', 'neighborhood', 'sublocality'].includes(t))) {
      return 'destination';
    }
    return 'stop';
  };

  const mapNearbyTransitType = (
    primaryType?: string,
    types: string[] = []
  ): {
    type: 'subway_station' | 'train_station' | 'bus_station' | 'ferry_terminal' | 'transit_station';
    label: string;
  } => {
    const all = [primaryType || '', ...types];
    if (all.includes('subway_station')) return { type: 'subway_station', label: 'Subway / Metro' };
    if (all.includes('train_station') || all.includes('light_rail_station')) {
      return { type: 'train_station', label: 'Train Station' };
    }
    if (all.includes('ferry_terminal')) return { type: 'ferry_terminal', label: 'Ferry Terminal' };
    if (all.includes('bus_station') || all.includes('bus_stop')) {
      return { type: 'bus_station', label: 'Bus Station' };
    }
    return { type: 'transit_station', label: 'Transit Hub' };
  };

  app.get('/api/maps/config', (_req: Request, res: Response) => {
    const apiKey = getMapsApiKey();
    res.json({
      configured: Boolean(apiKey),
      apiKey,
    });
  });

  app.post('/api/maps/resolve-stops', async (req: Request, res: Response) => {
    try {
      const apiKey = getMapsApiKey();
      if (!apiKey) {
        res.status(500).json({ error: 'Google Maps API key is not configured.' });
        return;
      }

      const body = (req.body || {}) as {
        country?: string;
        regionCode?: string;
        stops?: Array<{
          id?: string;
          title?: string;
          location?: string;
          category?: string;
          placeType?: string;
          placeId?: string;
        }>;
      };

      const country = String(body.country || '').trim();
      const regionCode = String(body.regionCode || '').trim().toLowerCase().slice(0, 2);
      const stops = Array.isArray(body.stops) ? body.stops.slice(0, 12) : [];

      if (stops.length === 0) {
        res.json({ resolved: [] });
        return;
      }

      let fallbackToClientSdk = false;
      let quotaExceeded = false;

      const resolved: Array<{
        activityId: string;
        query: string;
        placeId: string;
        displayName: string;
        formattedAddress: string;
        location: { lat: number; lng: number };
        stopType: string;
        googleMapsUri?: string;
        nearbyStations: Array<{
          placeId: string;
          name: string;
          type: string;
          label: string;
          formattedAddress: string;
          location: { lat: number; lng: number };
          distanceMeters: number;
        }>;
      }> = [];

      interface PlacesApiPlace {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        types?: string[];
        primaryType?: string;
        googleMapsUri?: string;
      }

      for (const stop of stops) {
        if (fallbackToClientSdk || quotaExceeded) break;
        const activityId = String(stop.id || '').trim();
        const title = String(stop.title || '').trim();
        const locationText = String(stop.location || '').trim();
        const query = [title, locationText, country].filter(Boolean).join(', ');
        if (!activityId || !query) continue;

        let place: PlacesApiPlace | null = null;

        // If we already have a stored Place ID (permitted indefinitely per ToS), fetch minimal live details
        const existingPlaceId = String(stop.placeId || '').trim();
        if (existingPlaceId) {
          const detailResp = await fetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(existingPlaceId)}`,
            {
              headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
                'X-Goog-FieldMask':
                  'id,displayName,formattedAddress,location,types,primaryType,googleMapsUri',
              },
              signal: AbortSignal.timeout(8000),
            }
          );
          if (detailResp.ok) {
            place = (await detailResp.json()) as PlacesApiPlace;
          } else {
            const errJson = await detailResp.json().catch(() => ({}));
            if (isMapsQuotaErrorPayload(detailResp.status, errJson)) {
              quotaExceeded = true;
              break;
            }
            if (isMapsReferrerBlockedPayload(detailResp.status, errJson)) {
              fallbackToClientSdk = true;
              break;
            }
          }
        }

        if (!place) {
          const searchBody: Record<string, unknown> = {
            textQuery: query,
            pageSize: 1,
            languageCode: 'en',
          };
          if (regionCode && /^[a-z]{2}$/.test(regionCode)) {
            searchBody.regionCode = regionCode;
          }

          const searchResp = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
              'X-Goog-FieldMask':
                'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.googleMapsUri',
            },
            body: JSON.stringify(searchBody),
            signal: AbortSignal.timeout(8000),
          });

          const searchData = (await searchResp.json().catch(() => ({}))) as {
            places?: PlacesApiPlace[];
          };

          if (!searchResp.ok) {
            if (isMapsQuotaErrorPayload(searchResp.status, searchData)) {
              quotaExceeded = true;
              break;
            }
            if (isMapsReferrerBlockedPayload(searchResp.status, searchData)) {
              fallbackToClientSdk = true;
              break;
            }
            continue;
          }

          place = searchData.places?.[0] || null;

          // Retry with location + country only if full title+location returned empty
          if (!place && locationText && locationText.toLowerCase() !== title.toLowerCase()) {
            const retryResp = await fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
                'X-Goog-FieldMask':
                  'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.googleMapsUri',
              },
              body: JSON.stringify({
                textQuery: [locationText, country].filter(Boolean).join(', '),
                pageSize: 1,
                languageCode: 'en',
              }),
              signal: AbortSignal.timeout(8000),
            });
            if (retryResp.ok) {
              const retryData = (await retryResp.json().catch(() => ({}))) as {
                places?: PlacesApiPlace[];
              };
              place = retryData.places?.[0] || null;
            }
          }
        }

        if (
          !place ||
          !place.id ||
          typeof place.location?.latitude !== 'number' ||
          typeof place.location?.longitude !== 'number'
        ) {
          continue;
        }

        const lat = place.location.latitude;
        const lng = place.location.longitude;

        // Nearby stations, bus stops, and terminals via Places Nearby Search (New)
        let nearbyStations: Array<{
          placeId: string;
          name: string;
          type: string;
          label: string;
          formattedAddress: string;
          location: { lat: number; lng: number };
          distanceMeters: number;
        }> = [];

        const nearbyResp = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types',
          },
          body: JSON.stringify({
            includedTypes: [
              'transit_station',
              'subway_station',
              'train_station',
              'bus_station',
              'ferry_terminal',
            ],
            maxResultCount: 5,
            rankPreference: 'DISTANCE',
            languageCode: 'en',
            locationRestriction: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: 1400.0,
              },
            },
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (nearbyResp.ok) {
          const nearbyData = (await nearbyResp.json().catch(() => ({}))) as {
            places?: PlacesApiPlace[];
          };
          nearbyStations = (nearbyData.places || [])
            .filter(
              (np) =>
                np.id &&
                typeof np.location?.latitude === 'number' &&
                typeof np.location?.longitude === 'number'
            )
            .map((np) => {
              const npLoc = {
                lat: np.location!.latitude!,
                lng: np.location!.longitude!,
              };
              const mapped = mapNearbyTransitType(np.primaryType, np.types);
              return {
                placeId: np.id!,
                name: np.displayName?.text || 'Transit Station',
                type: mapped.type,
                label: mapped.label,
                formattedAddress: np.formattedAddress || '',
                location: npLoc,
                distanceMeters: haversineMeters({ lat, lng }, npLoc),
              };
            })
            .slice(0, 4);
        }

        resolved.push({
          activityId,
          query,
          placeId: place.id,
          displayName: place.displayName?.text || title,
          formattedAddress: place.formattedAddress || locationText || country,
          location: { lat, lng },
          stopType: inferStopTypeFromPlace(stop.placeType, stop.category, place.types),
          googleMapsUri: place.googleMapsUri,
          nearbyStations,
        });
      }

      if (quotaExceeded) {
        res.status(429).json({
          error: 'Google Maps Platform quota reached.',
          quotaExceeded: true,
        });
        return;
      }

      if (fallbackToClientSdk) {
        res.json({ resolved: [], fallbackToClientSdk: true });
        return;
      }

      res.json({ resolved });
    } catch (err: unknown) {
      console.error('Error resolving stops:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to resolve itinerary stop locations.',
      });
    }
  });

  app.post('/api/maps/route', async (req: Request, res: Response) => {
    try {
      const apiKey = getMapsApiKey();
      if (!apiKey) {
        res.status(500).json({ error: 'Google Maps API key is not configured.' });
        return;
      }

      const body = (req.body || {}) as {
        originQuery?: string;
        originLocation?: { lat: number; lng: number };
        destinationQuery?: string;
        destinationLocation?: { lat: number; lng: number };
        travelModes?: string[];
      };

      const buildWaypoint = (
        loc?: { lat: number; lng: number },
        address?: string
      ): Record<string, unknown> | null => {
        if (
          loc &&
          typeof loc.lat === 'number' &&
          typeof loc.lng === 'number' &&
          Number.isFinite(loc.lat) &&
          Number.isFinite(loc.lng)
        ) {
          return {
            location: {
              latLng: { latitude: loc.lat, longitude: loc.lng },
            },
          };
        }
        if (address?.trim()) {
          return { address: address.trim().slice(0, 200) };
        }
        return null;
      };

      const origin = buildWaypoint(body.originLocation, body.originQuery);
      const destination = buildWaypoint(body.destinationLocation, body.destinationQuery);

      if (!origin || !destination) {
        res.status(400).json({
          error: 'Origin and destination coordinates or addresses are required.',
        });
        return;
      }

      const requestedModes = (
        Array.isArray(body.travelModes) && body.travelModes.length > 0
          ? body.travelModes
          : ['TRANSIT', 'DRIVE', 'WALK']
      ).filter((m) => m === 'TRANSIT' || m === 'DRIVE' || m === 'WALK');

      let fallbackToClientSdk = false;
      let quotaExceeded = false;

      interface RoutesApiResponse {
        routes?: Array<{
          duration?: string;
          distanceMeters?: number;
          polyline?: { encodedPolyline?: string };
          legs?: Array<{
            steps?: Array<{
              travelMode?: string;
              distanceMeters?: number;
              staticDuration?: string;
              navigationInstruction?: {
                instructions?: string;
                maneuver?: string;
              };
              transitDetails?: {
                stopCount?: number;
                stopDetails?: {
                  arrivalStop?: { name?: string };
                  departureStop?: { name?: string };
                  departureTime?: string;
                  arrivalTime?: string;
                };
                transitLine?: {
                  name?: string;
                  nameShort?: string;
                  vehicle?: { type?: string };
                  agencies?: Array<{ name?: string }>;
                };
              };
            }>;
          }>;
        }>;
      }

      const computeMode = async (mode: 'TRANSIT' | 'DRIVE' | 'WALK') => {
        const requestPayload: Record<string, unknown> = {
          origin,
          destination,
          travelMode: mode,
          computeAlternativeRoutes: false,
          languageCode: 'en-US',
          units: 'METRIC',
        };

        // Strictly omit top-level routingPreference for TRANSIT and WALK (Routes API rule)
        if (mode === 'DRIVE') {
          requestPayload.routingPreference = 'TRAFFIC_AWARE';
        } else if (mode === 'TRANSIT') {
          requestPayload.transitPreferences = {
            routingPreference: 'FEWER_TRANSFERS',
          };
        }

        const resp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
            'X-Goog-FieldMask':
              'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.legs.steps.transitDetails',
          },
          body: JSON.stringify(requestPayload),
          signal: AbortSignal.timeout(9000),
        });

        const data = (await resp.json().catch(() => ({}))) as RoutesApiResponse;
        if (!resp.ok) {
          if (isMapsQuotaErrorPayload(resp.status, data)) {
            quotaExceeded = true;
          } else if (isMapsReferrerBlockedPayload(resp.status, data)) {
            fallbackToClientSdk = true;
          }
          return null;
        }

        const route = data.routes?.[0];
        if (!route) return null;

        const durationSeconds = parseDurationSeconds(route.duration);
        const distanceMeters = Number(route.distanceMeters) || 0;
        const rawSteps = route.legs?.[0]?.steps || [];
        const steps = rawSteps.map((s, idx) => {
          const td = s.transitDetails;
          const transit = td
            ? {
                lineName: td.transitLine?.name,
                lineShortName: td.transitLine?.nameShort,
                vehicleType: td.transitLine?.vehicle?.type,
                agencyName: td.transitLine?.agencies?.[0]?.name,
                departureStop: td.stopDetails?.departureStop?.name,
                arrivalStop: td.stopDetails?.arrivalStop?.name,
                numStops: td.stopCount,
                departureTimeText: td.stopDetails?.departureTime,
                arrivalTimeText: td.stopDetails?.arrivalTime,
              }
            : undefined;
          const fallbackInstr = transit
            ? `Take ${transit.lineShortName || transit.lineName || transit.vehicleType || 'transit'} from ${transit.departureStop || 'station'} to ${transit.arrivalStop || 'stop'}`
            : s.travelMode === 'WALK'
              ? 'Walk along route'
              : 'Continue on route';
          return {
            stepNumber: idx + 1,
            travelMode: s.travelMode || mode,
            instruction: s.navigationInstruction?.instructions || fallbackInstr,
            distanceText: formatDistanceM(Number(s.distanceMeters) || 0),
            durationText: formatDurationSec(parseDurationSeconds(s.staticDuration)),
            ...(transit ? { transit } : {}),
          };
        });

        return {
          mode,
          durationText: formatDurationSec(durationSeconds),
          durationSeconds,
          distanceText: formatDistanceM(distanceMeters),
          distanceMeters,
          encodedPolyline: route.polyline?.encodedPolyline,
          steps,
          ...(mode === 'WALK'
            ? {
                warning:
                  'Walking routes are in beta and might sometimes be missing clear sidewalks or pedestrian paths.',
              }
            : {}),
        };
      };

      const entries = await Promise.all(
        requestedModes.map(async (mode) => [
          mode,
          await computeMode(mode as 'TRANSIT' | 'DRIVE' | 'WALK'),
        ])
      );

      if (quotaExceeded) {
        res.status(429).json({
          error: 'Google Maps Platform quota reached.',
          quotaExceeded: true,
        });
        return;
      }

      if (fallbackToClientSdk) {
        res.json({ routes: {}, fallbackToClientSdk: true });
        return;
      }

      res.json({ routes: Object.fromEntries(entries) });
    } catch (err: unknown) {
      console.error('Error computing Google routes:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to compute route.',
      });
    }
  });

  app.post('/api/maps/ai-route-assistant', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        country?: string;
        originLabel?: string;
        destinationLabel?: string;
        distanceHint?: string;
        nearbyStations?: string[];
        preferredPriority?: string;
      };

      const country = String(body.country || '').trim();
      const originLabel = String(body.originLabel || '').trim();
      const destinationLabel = String(body.destinationLabel || '').trim();
      const distanceHint = String(body.distanceHint || '').trim();
      const nearbyStations = Array.isArray(body.nearbyStations)
        ? body.nearbyStations.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
        : [];
      const preferredPriority = String(body.preferredPriority || 'Convenient & Affordable').trim();

      if (!country || !originLabel || !destinationLabel) {
        res.status(400).json({
          error: 'Country, starting point, and destination are required.',
        });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'Gemini API key is not configured. Please check your environment secrets.',
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        `Compare practical transportation options from "${originLabel}" to "${destinationLabel}" in ${country}.`,
        distanceHint ? `Approximate route metrics: ${distanceHint}.` : '',
        nearbyStations.length > 0
          ? `Nearby transit stations/terminals near the destination: ${nearbyStations.join(', ')}.`
          : '',
        `Traveler preference: ${preferredPriority}.`,
        `Compare available modes among Bus, Train, Subway, Taxi, Car, Ferry (if water crossing exists), and Walking (if feasible), clearly highlighting the best convenient & affordable recommendation, transfer stations, local currency fare, and PHP equivalent.`,
      ]
        .filter(Boolean)
        .join('\n');

      const systemInstruction = `You are a worldwide AI route & transit assistant. Use Google Search when helpful to verify real local operators, metro/train/bus lines, ferries, ride-hailing apps, and published fares in ${country}.
Return JSON matching the schema:
- originLabel, destinationLabel
- recommendedMode: one of ["Bus", "Train", "Subway", "Taxi", "Car", "Ferry", "Walking"]
- summary: 1-2 sentences explaining the most convenient and affordable option including transfer tips
- nearbyStationsSummary: concise note referencing nearby transit stations/bus stops/terminals for arrival
- options: 3 to 5 transport options comparing distinct modes (include Bus, Train/Subway, Taxi/Car, Ferry if applicable, Walking if walkable). Each option needs:
  - mode (exact enum from the 7 above)
  - operator (e.g. "Tokyo Metro Ginza Line", "Grab / Metered Taxi", "Public Bus #205", "On foot")
  - departurePoint, arrivalPoint
  - duration, distance
  - fareLocal (e.g. "¥210" or "Free")
  - estimatedPhpFare (whole-number PHP equivalent per person)
  - schedule (e.g. "Every 5-8 mins, 05:00-23:45" or "On-demand 24/7")
  - verificationStatus: "verified" ONLY if backed by official operator/fare search results and NOT Taxi/Car/Walking; otherwise "estimated"
  - verificationNote: clear distinction of verified vs estimated schedule/fare
  - bookingUrl: https:// URL if applicable, else ""
  - recommended: boolean (true for top recommendation)
  - steps: 2-4 crisp step-by-step directions (stepNumber, mode, instruction, terminalOrStation, duration, lastMileTip)
  - sourceLinks: official transit source URLs { title, url }`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          originLabel: { type: Type.STRING },
          destinationLabel: { type: Type.STRING },
          recommendedMode: { type: Type.STRING },
          summary: { type: Type.STRING },
          nearbyStationsSummary: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                mode: { type: Type.STRING },
                operator: { type: Type.STRING },
                departurePoint: { type: Type.STRING },
                arrivalPoint: { type: Type.STRING },
                duration: { type: Type.STRING },
                distance: { type: Type.STRING },
                fareLocal: { type: Type.STRING },
                estimatedPhpFare: { type: Type.NUMBER },
                schedule: { type: Type.STRING },
                verificationStatus: { type: Type.STRING },
                verificationNote: { type: Type.STRING },
                bookingUrl: { type: Type.STRING },
                recommended: { type: Type.BOOLEAN },
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepNumber: { type: Type.INTEGER },
                      mode: { type: Type.STRING },
                      instruction: { type: Type.STRING },
                      terminalOrStation: { type: Type.STRING },
                      duration: { type: Type.STRING },
                      lastMileTip: { type: Type.STRING },
                    },
                    required: ['stepNumber', 'mode', 'instruction'],
                  },
                },
                sourceLinks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      url: { type: Type.STRING },
                    },
                    required: ['title', 'url'],
                  },
                },
              },
              required: [
                'mode',
                'operator',
                'departurePoint',
                'arrivalPoint',
                'duration',
                'distance',
                'fareLocal',
                'estimatedPhpFare',
                'schedule',
                'verificationStatus',
                'verificationNote',
                'steps',
              ],
            },
          },
        },
        required: ['recommendedMode', 'summary', 'options'],
      };

      const VALID_NAV_MODES = new Set([
        'Bus',
        'Train',
        'Subway',
        'Taxi',
        'Car',
        'Ferry',
        'Walking',
      ]);

      interface RawAssistant {
        originLabel?: string;
        destinationLabel?: string;
        recommendedMode?: string;
        summary?: string;
        nearbyStationsSummary?: string;
        options?: Array<{
          mode?: string;
          operator?: string;
          departurePoint?: string;
          arrivalPoint?: string;
          duration?: string;
          distance?: string;
          fareLocal?: string;
          estimatedPhpFare?: number;
          schedule?: string;
          verificationStatus?: string;
          verificationNote?: string;
          bookingUrl?: string;
          recommended?: boolean;
          steps?: Array<{
            stepNumber?: number;
            mode?: string;
            instruction?: string;
            terminalOrStation?: string;
            duration?: string;
            lastMileTip?: string;
          }>;
          sourceLinks?: Array<{ title?: string; url?: string }>;
        }>;
      }

      const { parsed, groundedLinks, hasWebGrounding } =
        await generateGroundedJson<RawAssistant>(ai, prompt, systemInstruction, schema);

      const recommendedMode = VALID_NAV_MODES.has(String(parsed.recommendedMode || '').trim())
        ? String(parsed.recommendedMode).trim()
        : 'Subway';

      const options = (Array.isArray(parsed.options) ? parsed.options : [])
        .slice(0, 6)
        .map((opt) => {
          const mode = VALID_NAV_MODES.has(String(opt.mode || '').trim())
            ? String(opt.mode).trim()
            : 'Bus';
          const bookingUrl = sanitizeHttpUrl(opt.bookingUrl);
          const mergedSources = extractGroundedLinks(
            { candidates: [{ groundingMetadata: { groundingChunks: [] } }] },
            [...(Array.isArray(opt.sourceLinks) ? opt.sourceLinks : []), ...groundedLinks]
          );
          const isDynamic = mode === 'Taxi' || mode === 'Car' || mode === 'Walking';
          const isVerified =
            String(opt.verificationStatus || '').toLowerCase() === 'verified' &&
            !isDynamic &&
            (hasWebGrounding || mergedSources.length > 0);
          return {
            mode,
            operator: String(opt.operator || 'Local Service').trim().slice(0, 120),
            departurePoint: String(opt.departurePoint || originLabel).trim().slice(0, 140),
            arrivalPoint: String(opt.arrivalPoint || destinationLabel).trim().slice(0, 140),
            duration: String(opt.duration || 'Varies').trim().slice(0, 60),
            distance: String(opt.distance || '').trim().slice(0, 40),
            fareLocal: String(opt.fareLocal || 'Check operator').trim().slice(0, 80),
            estimatedPhpFare: Math.max(
              0,
              Math.min(1000000000, Math.round(Number(opt.estimatedPhpFare) || 0))
            ),
            schedule: String(opt.schedule || 'Daily service').trim().slice(0, 160),
            verificationStatus: isVerified ? 'verified' : 'estimated',
            verificationNote: String(
              opt.verificationNote ||
                (isVerified
                  ? 'Operator & typical fare matched search sources; confirm live departure.'
                  : 'Estimated fare & travel time; verify local rates before departing.')
            )
              .trim()
              .slice(0, 240),
            ...(bookingUrl ? { bookingUrl } : {}),
            recommended: Boolean(opt.recommended) || mode === recommendedMode,
            steps: Array.isArray(opt.steps)
              ? opt.steps.slice(0, 6).map((s, sIdx) => ({
                  stepNumber: Math.max(1, Math.round(Number(s.stepNumber) || sIdx + 1)),
                  mode: String(s.mode || mode).trim().slice(0, 40),
                  instruction: String(s.instruction || 'Follow route signs')
                    .trim()
                    .slice(0, 260),
                  ...(s.terminalOrStation?.trim()
                    ? { terminalOrStation: s.terminalOrStation.trim().slice(0, 120) }
                    : {}),
                  ...(s.duration?.trim() ? { duration: s.duration.trim().slice(0, 40) } : {}),
                  ...(s.lastMileTip?.trim()
                    ? { lastMileTip: s.lastMileTip.trim().slice(0, 180) }
                    : {}),
                }))
              : [],
            sourceLinks: mergedSources,
          };
        });

      res.json({
        originLabel: String(parsed.originLabel || originLabel).trim().slice(0, 140),
        destinationLabel: String(parsed.destinationLabel || destinationLabel).trim().slice(0, 140),
        recommendedMode,
        summary: String(parsed.summary || '').trim().slice(0, 400),
        nearbyStationsSummary: String(parsed.nearbyStationsSummary || '').trim().slice(0, 280),
        options,
      });
    } catch (err: unknown) {
      const message = extractGeminiError(
        err,
        'Failed to load AI route comparisons.'
      );
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      console.error('Error in AI route assistant:', err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
