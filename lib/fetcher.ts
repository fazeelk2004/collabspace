/** Thin client-side fetch wrapper: JSON in/out, throws readable errors. */
export class FetchError extends Error {
  status: number;
  issues?: Record<string, string[]>;
  constructor(message: string, status: number, issues?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

export async function api<T>(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let issues: Record<string, string[]> | undefined;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
      issues = data.issues;
    } catch {}
    throw new FetchError(message, res.status, issues);
  }
  return res.json() as Promise<T>;
}
