// Client-side app preferences, persisted in localStorage.

export type Theme = 'dark' | 'light';

const THEME_KEY = 'sm.theme';
const COOLING_KEY = 'sm.coolingOffDays';
const ACTIVE_BIZ_KEY = 'sm.activeBusinessId';

// Light is the default — warm and inviting; dark stays one tap away.
export function getTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

// Days of silence before a contact shows up in "Who needs you today".
export function getCoolingOffDays(): number {
  const raw = Number(localStorage.getItem(COOLING_KEY));
  return Number.isFinite(raw) && raw >= 1 && raw <= 60 ? raw : 7;
}

export function setCoolingOffDays(days: number) {
  localStorage.setItem(COOLING_KEY, String(days));
}

const MISSIONS_PINNED_KEY = 'sm.missionsPinned';

export function getMissionsPinned(): boolean {
  return localStorage.getItem(MISSIONS_PINNED_KEY) === '1';
}

export function setMissionsPinned(pinned: boolean) {
  localStorage.setItem(MISSIONS_PINNED_KEY, pinned ? '1' : '0');
}

export function getActiveBusinessId(): string | null {
  return localStorage.getItem(ACTIVE_BIZ_KEY);
}

export function setActiveBusinessId(id: string) {
  localStorage.setItem(ACTIVE_BIZ_KEY, id);
}
