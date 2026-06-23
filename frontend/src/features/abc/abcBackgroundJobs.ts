import { getAuth } from "firebase/auth";

const ACTIVE_KEY_PREFIX = "abc-active-upload-ids";
const NOTIFIED_KEY_PREFIX = "abc-notified-upload-ids";

function activeKey(): string {
  const uid = getAuth().currentUser?.uid ?? "anonymous";
  return `${ACTIVE_KEY_PREFIX}-${uid}`;
}

function notifiedKey(): string {
  const uid = getAuth().currentUser?.uid ?? "anonymous";
  return `${NOTIFIED_KEY_PREFIX}-${uid}`;
}

export function trackAbcBackgroundJob(uploadId: string): void {
  const ids = loadActiveAbcJobs();
  if (!ids.includes(uploadId)) {
    sessionStorage.setItem(activeKey(), JSON.stringify([...ids, uploadId]));
  }
}

export function untrackAbcBackgroundJob(uploadId: string): void {
  const ids = loadActiveAbcJobs().filter((id) => id !== uploadId);
  if (ids.length > 0) {
    sessionStorage.setItem(activeKey(), JSON.stringify(ids));
  } else {
    sessionStorage.removeItem(activeKey());
  }
}

export function loadActiveAbcJobs(): string[] {
  try {
    const raw = sessionStorage.getItem(activeKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markAbcJobNotified(uploadId: string): void {
  const ids = loadNotifiedAbcJobs();
  if (!ids.includes(uploadId)) {
    sessionStorage.setItem(notifiedKey(), JSON.stringify([...ids, uploadId]));
  }
}

export function wasAbcJobNotified(uploadId: string): boolean {
  return loadNotifiedAbcJobs().includes(uploadId);
}

function loadNotifiedAbcJobs(): string[] {
  try {
    const raw = sessionStorage.getItem(notifiedKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
