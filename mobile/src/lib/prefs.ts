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

// Days of silence before a contact shows up in "Who needs you today".
export async function getCoolingOffDays(): Promise<number> {
  const raw = Number(await AsyncStorage.getItem(COOLING_KEY));
  return Number.isFinite(raw) && raw >= 1 && raw <= 60 ? raw : 7;
}

export async function setCoolingOffDays(days: number): Promise<void> {
  await AsyncStorage.setItem(COOLING_KEY, String(days));
}
