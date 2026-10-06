import { describe, it, expect } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST as siteAssistantPOST } from '@/app/api/ai/site-assistant/route';

function makeRequest(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(url, init);
}

describe('Field Portal & AI Site Assistant Unit Tests', () => {
  it('should validate missing transcript and reject with 400', async () => {
    const request = makeRequest('/api/ai/site-assistant', {
      method: 'POST',
      body: { action: 'format_inspection' },
    });

    const response = await siteAssistantPOST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should process speech transcript using fallback parser in Arabic', async () => {
    const request = makeRequest('/api/ai/site-assistant', {
      method: 'POST',
      body: {
        audioTranscript: 'تم صب أعمدة الدور الأول وفحص كانات حديد التسليح وبها تعشيش عميق',
        action: 'format_inspection',
        projectName: 'فيلا السعادة',
        language: 'ar',
      },
    });

    const response = await siteAssistantPOST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('title');
    expect(data.data).toHaveProperty('findings');
    expect(data.data).toHaveProperty('defects');
    expect(Array.isArray(data.data.defects)).toBe(true);
    expect(data.data.defects.length).toBeGreaterThan(0);
    expect(data.data.defects[0].severity).toBe('CRITICAL');
  });

  it('should process speech transcript using fallback parser in English', async () => {
    const request = makeRequest('/api/ai/site-assistant', {
      method: 'POST',
      body: {
        audioTranscript: 'Inspection of ground floor slab completed with major crack observed near column C2',
        action: 'format_inspection',
        projectName: 'Dubai Marina Villa',
        language: 'en',
      },
    });

    const response = await siteAssistantPOST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.title).toContain('Site Inspection Report');
    expect(data.data.defects[0].severity).toBe('CRITICAL');
  });
});
