// App preferences persisted on-device with AsyncStorage — the native
// counterpart to the web client's localStorage-backed appSettings.
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_BIZ_KEY = 'sm.activeBusinessId';
const COOLING_KEY = 'sm.coolingOffDays';

export async function getActiveBusinessId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_BIZ_KEY);
}

export async function setActiveBusinessId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_BIZ_KEY, id);
}

// Interest categories picked during the new-founder onboarding path. They
// personalize the Discover feed until a business exists to personalize by.
const INTERESTS_KEY = 'sm.interests';

export async function getInterests(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INTERESTS_KEY);
  return raw ? raw.split(',').filter(Boolean) : [];
}

export async function setInterests(interests: string[]): Promise<void> {
  await AsyncStorage.setItem(INTERESTS_KEY, interests.join(','));
}

// Days in a row the app has been opened, shown in the top bar.
//
// Deliberately forgiving about *when* the day rolls over: it compares
// local calendar dates, so someone logging a sale at 1am hasn't broken
// anything. Miss a whole day and it resets to 1 — a streak that survives
// gaps isn't a streak, and the number stops meaning anything.
const STREAK_KEY = 'sm.streak';

function today(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, locale-stable
}

export async function touchStreak(): Promise<number> {
  const raw = await AsyncStorage.getItem(STREAK_KEY);
  const [lastDay, lastCount] = raw ? raw.split('|') : [null, '0'];
  const now = today();
  if (lastDay === now) return Number(lastCount) || 1;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const consecutive = lastDay === yesterday.toLocaleDateString('en-CA');

  const next = consecutive ? (Number(lastCount) || 0) + 1 : 1;
  await AsyncStorage.setItem(STREAK_KEY, `${now}|${next}`);
  return next;
}

// Days of silence before a contact shows up in "Who needs you today".
export async function getCoolingOffDays(): Promise<number> {
  const raw = Number(await AsyncStorage.getItem(COOLING_KEY));
  return Number.isFinite(raw) && raw >= 1 && raw <= 60 ? raw : 7;
}

export async function setCoolingOffDays(days: number): Promise<void> {
  await AsyncStorage.setItem(COOLING_KEY, String(days));
}
