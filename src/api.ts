import { APPS_SCRIPT_URL, DEFAULT_CATEGORIES } from "./config";

export interface StatusResponse {
  success: boolean;
  status?: string;
  error?: string;
  allocated?: string | null;
  remaining?: string[];
  allCategories?: string[];
}

export interface LoginResponse {
  success: boolean;
  status?: string;
  error?: string;
  team?: number;
}

export interface SpinResponse {
  success: boolean;
  status?: string;
  error?: string;
  category?: string;
  alreadySpun?: boolean;
}

// Local mock storage for dry run when APPS_SCRIPT_URL is not yet set
const MOCK_STORAGE_KEY = "bwd_mock_db";

interface MockDB {
  allocations: { team: number; category: string }[];
  attempts: { team: number; count: number };
}

function getMockDB(): MockDB {
  const data = localStorage.getItem(MOCK_STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      // ignore
    }
  }
  return { allocations: [], attempts: { team: 0, count: 0 } };
}

function saveMockDB(db: MockDB) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
}

export async function apiLogin(team: number, name: string, code: string): Promise<LoginResponse> {
  if (!APPS_SCRIPT_URL) {
    // Local demo validation
    if (code.length !== 4) {
      return { success: false, status: "invalid", error: "Please enter a valid 4-digit code." };
    }
    return { success: true, status: "ok", team };
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "login", team, name, code }),
    });
    return await response.json();
  } catch (error) {
    // Fallback: try GET if POST fails due to network/CORS issues
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("action", "login");
    url.searchParams.set("team", String(team));
    url.searchParams.set("name", name);
    url.searchParams.set("code", code);
    const getRes = await fetch(url.toString());
    return await getRes.json();
  }
}

export async function apiStatus(team: number, name: string, code: string): Promise<StatusResponse> {
  if (!APPS_SCRIPT_URL) {
    const db = getMockDB();
    const existing = db.allocations.find((a) => a.team === team);
    const taken = new Set(db.allocations.map((a) => a.category));
    const remaining = DEFAULT_CATEGORIES.filter((c) => !taken.has(c));
    return {
      success: true,
      allocated: existing ? existing.category : null,
      remaining,
      allCategories: DEFAULT_CATEGORIES,
    };
  }

  try {
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("action", "status");
    url.searchParams.set("team", String(team));
    url.searchParams.set("name", name);
    url.searchParams.set("code", code);
    url.searchParams.set("_t", String(Date.now())); // prevent caching
    const response = await fetch(url.toString());
    return await response.json();
  } catch (error) {
    return { success: false, error: "Network error fetching status" };
  }
}

export async function apiSpin(team: number, name: string, code: string): Promise<SpinResponse> {
  if (!APPS_SCRIPT_URL) {
    const db = getMockDB();
    const existing = db.allocations.find((a) => a.team === team);
    if (existing) {
      return { success: true, category: existing.category, alreadySpun: true };
    }
    const taken = new Set(db.allocations.map((a) => a.category));
    const remaining = DEFAULT_CATEGORIES.filter((c) => !taken.has(c));
    if (remaining.length === 0) {
      return { success: false, error: "No categories left to spin!" };
    }
    const chosen = remaining[Math.floor(Math.random() * remaining.length)];
    db.allocations.push({ team, category: chosen });
    saveMockDB(db);
    return { success: true, category: chosen, alreadySpun: false };
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "spin", team, name, code }),
    });
    return await response.json();
  } catch (error) {
    // Fallback: try GET if POST fails
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("action", "spin");
    url.searchParams.set("team", String(team));
    url.searchParams.set("name", name);
    url.searchParams.set("code", code);
    const getRes = await fetch(url.toString());
    return await getRes.json();
  }
}
