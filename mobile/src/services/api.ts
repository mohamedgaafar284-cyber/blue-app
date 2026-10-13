import * as SecureStore from 'expo-secure-store';
import { getUnsyncedVisits, markVisitAsSynced, cacheProjects, CachedProject } from './db';

// Next.js backend API URL (Local host or production backend)
const BACKEND_API_URL = 'https://blue-app.blueprint.ae/api';

export async function setAuthToken(token: string) {
  await SecureStore.setItemAsync('jwt_token', token);
}

export async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync('jwt_token');
}

export async function removeAuthToken() {
  await SecureStore.deleteItemAsync('jwt_token');
}

export async function loginWithApi(email: string, password: string): Promise<string> {
  const response = await fetch(`${BACKEND_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error('No authentication token returned');
  }

  await setAuthToken(data.token);
  return data.token;
}

// Fetch active projects and cache them locally
export async function fetchAndCacheProjects(): Promise<CachedProject[]> {
  const token = await getAuthToken();
  if (!token) throw new Error('Unauthorized');

  try {
    const response = await fetch(`${BACKEND_API_URL}/projects-simple`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch projects');

    const data = (await response.json()) as Array<{
      id: string;
      name: string;
      location?: string;
      status?: string;
      progress?: number;
    }>;
    const projects: CachedProject[] = data.map((p) => ({
      id: p.id,
      name: p.name,
      location: p.location || 'Dubai, UAE',
      status: p.status || 'ACTIVE',
      progress: p.progress || 0
    }));

    // Cache projects inside SQLite database
    await cacheProjects(projects);
    return projects;
  } catch (error) {
    console.warn('[API] Offline or fetch failed, falling back to local DB cache', error);
    throw error;
  }
}

// Sync Protocol: Sequential sync of unsynced site visits
export async function syncOfflineData(): Promise<{ syncedCount: number; failedCount: number }> {
  const token = await getAuthToken();
  if (!token) return { syncedCount: 0, failedCount: 0 };

  const unsyncedVisits = await getUnsyncedVisits();
  let syncedCount = 0;
  let failedCount = 0;

  for (const visit of unsyncedVisits) {
    try {
      // Simulate photo upload if photoUri is set
      let uploadedPhotoUrl = null;
      if (visit.photoUri) {
        // Upload simulation
        uploadedPhotoUrl = `https://storage.blueprint.ae/visits/photos/${visit.id}.jpg`;
      }

      // Sync data sequentially
      const response = await fetch(`${BACKEND_API_URL}/site-visits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: visit.projectId,
          visitDate: visit.visitDate,
          latitude: visit.latitude,
          longitude: visit.longitude,
          inspectorName: visit.inspectorName,
          notes: visit.notes,
          photoUrl: uploadedPhotoUrl
        })
      });

      if (response.ok) {
        await markVisitAsSynced(visit.id);
        syncedCount++;
      } else {
        failedCount++;
      }
    } catch (error) {
      console.error(`[Sync] Failed to sync site visit ${visit.id}`, error);
      failedCount++;
    }
  }

  return { syncedCount, failedCount };
}
