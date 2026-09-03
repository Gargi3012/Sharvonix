// Next.js App Router API Route: /api/chat
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are Sharvonix AI, the official assistant for Sharvonix digital experience studio (founded by Gargi Sharma and Shubham Sharma).
Studio Info:
- Packages: Starter (₹5,999), Business (₹9,999 - Most Popular), Custom Growth (₹15,999).
- Delivery: 3 to 7 business days.
- Tech Stack: Next.js, Tailwind CSS, Supabase, Vercel, Figma.
- Direct Contact: WhatsApp +91 79882 07356 / +91 70154 36857 | sharvonix@gmail.com.

STRICT GUARDRAILS:
- ONLY answer questions about Sharvonix services, web design, pricing, process, and booking.
- If user asks any unrelated question (e.g. general knowledge, math, coding help, other brands), politely refuse: 'I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand?'
- When someone is interested, collect their Name and WhatsApp number and prompt them to connect directly on WhatsApp (+91 79882 07356).`;

export async function POST(req) {
  try {
    const body = await req.json();
    const userMessage = (body.message || (body.messages && body.messages[body.messages.length - 1]?.content) || '').trim();

    if (!userMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Google Gemini API (if GEMINI_API_KEY is available)
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `System Instruction:\n${SYSTEM_PROMPT}\n\nUser Query: ${userMessage}` }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 350
              }
            })
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return NextResponse.json({ reply });
          }
        }
      } catch (err) {
        console.warn('Gemini call skipped, evaluating guardrails locally:', err.message);
      }
    }

    // 2. OpenAI API (if OPENAI_API_KEY is available)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.3,
            max_tokens: 350
          })
        });

        if (openaiRes.ok) {
          const data = await openaiRes.json();
          const reply = data?.choices?.[0]?.message?.content;
          if (reply) {
            return NextResponse.json({ reply });
          }
        }
      } catch (err) {
        console.warn('OpenAI call skipped, evaluating guardrails locally:', err.message);
      }
    }

    // 3. Fallback Deterministic Guardrail Engine
    const reply = evaluateGuardrails(userMessage);
    return NextResponse.json({ reply });

  } catch (error) {
    console.error('API /api/chat error:', error);
    return NextResponse.json({
      reply: "I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand? You can connect directly on WhatsApp at +91 79882 07356."
    }, { status: 500 });
  }
}

function evaluateGuardrails(userMessage) {
  const q = userMessage.toLowerCase();

  const offTopicKeywords = [
    'capital of', 'who is president', 'weather', 'recipe', 'solve', 'calculate',
    'python homework', 'java code', 'write a poem', 'tell a joke', 'who won', 'history of',
    'movie', 'actor', 'song', 'sports', 'cricket score', 'crypto price'
  ];

  for (const kw of offTopicKeywords) {
    if (q.includes(kw)) {
      return "I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand?";
    }
  }

  if (q.includes('start') || q.includes('hire') || q.includes('book') || q.includes('interested') || q.includes('build my') || q.includes('contact')) {
    return "We'd love to build your website! Please share your Name and WhatsApp number so Gargi and Shubham can reach out, or connect directly on WhatsApp at +91 79882 07356.";
  }

  if (q.includes('price') || q.includes('cost') || q.includes('package') || q.includes('plan') || q.includes('rate')) {
    return "Our studio packages:\n• Starter Plan: ₹5,999 (Essential modern landing page, 3–5 days)\n• Business Plan: ₹9,999 (Most Popular – multi-section custom web experience, animations, responsive design)\n• Custom Growth Plan: ₹15,999 (Complex web app, custom AI integrations, priority delivery)\n\nWould you like to connect directly on WhatsApp (+91 79882 07356) to discuss your project?";
  }

  if (q.includes('fast') || q.includes('time') || q.includes('deliver') || q.includes('days')) {
    return "Our typical turnaround time is 3 to 7 business days with direct founder-level dedication from day one.";
  }

  if (q.includes('founder') || q.includes('who are') || q.includes('gargi') || q.includes('shubham') || q.includes('team')) {
    return "Sharvonix is an independent digital experience studio founded by Gargi Sharma and Shubham Sharma. Direct WhatsApp: +91 79882 07356 / +91 70154 36857.";
  }

  if (q.includes('tech') || q.includes('stack') || q.includes('framework') || q.includes('wordpress')) {
    return "We specialize in modern web technologies: Next.js, Tailwind CSS, Supabase, Vercel, and Figma—crafted custom for maximum speed and conversions.";
  }

  return "I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand? You can connect directly on WhatsApp at +91 79882 07356.";
}
