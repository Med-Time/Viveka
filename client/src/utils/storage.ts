export function safeGetJson(key: string): any | null {
  const raw = localStorage.getItem(key);
  if (!raw || raw === "undefined") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function safeSetJson(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value ?? {}));
  } catch {
    // ignore
  }
}