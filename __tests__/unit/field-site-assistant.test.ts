import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { POST as siteAssistantPOST } from '@/app/api/ai/site-assistant/route';
import { getJwtSecretBytes } from '@/lib/auth/jwt-secret';
import { db } from '@/lib/db';

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!';

const spyDbUserFindUnique = jest.spyOn(db.user, 'findUnique');

async function generateTestToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('blueprint-saas')
    .setAudience('blueprint-users')
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(getJwtSecretBytes());
}

async function makeAuthenticatedRequest(
  path: string,
  options: { method?: string; body?: unknown; role?: string } = {}
): Promise<NextRequest> {
  const role = options.role || 'ADMIN';
  const token = await generateTestToken({
    userId: 'test-user-1',
    email: 'engineer@blueprint.ae',
    role,
    type: 'access',
    organizationId: 'org-test',
  });

  const url = `http://localhost:3000${path}`;
  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': `Bearer ${token}`,
      'x-user-id': 'test-user-1',
      'x-user-email': 'engineer@blueprint.ae',
      'x-user-role': role,
      'x-organization-id': 'org-test',
    },
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(url, init);
}

describe('Field Portal & AI Site Assistant Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    spyDbUserFindUnique.mockResolvedValue(null as any);
  });

  it('should validate missing transcript and reject with 400', async () => {
    const request = await makeAuthenticatedRequest('/api/ai/site-assistant', {
      body: { action: 'format_inspection' },
    });

    const response = await siteAssistantPOST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should process speech transcript using fallback parser in Arabic', async () => {
    const request = await makeAuthenticatedRequest('/api/ai/site-assistant', {
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
    const request = await makeAuthenticatedRequest('/api/ai/site-assistant', {
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
