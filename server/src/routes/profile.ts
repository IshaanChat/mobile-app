import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { emitEvent } from '../core/events';

export const profileRouter = Router();

const VALID_GENDERS = ['WOMAN', 'MAN', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY'];
const VALID_EXPERIENCE = ['FIRST_TIME', 'SOME_EXPERIENCE', 'EXPERIENCED'];

/**
 * What a profile must have.
 *
 * `gender` used to be required and is now optional, because nothing in the app
 * ever read it. App Store guideline 5.1.1(i) says an app may not require
 * personal information that is not relevant to its core functionality, and a
 * field that is collected, stored, and never used is the clearest possible
 * example. It stays *available* — some people want to be addressed correctly —
 * but it can no longer block anyone from finishing onboarding.
 *
 * `age` stays required, and that is a deliberate difference rather than an
 * oversight. It is not decoration: the 13 floor is the under-13 gate, which is
 * what keeps this app out of COPPA's scope. Removing it to satisfy 5.1.1(i)
 * would trade a small compliance risk for a much larger one. What was wrong
 * was the *claim* around it — onboarding told users it "helps us tune advice
 * to where you are", and nothing tunes anything on age. The honest reason is
 * the gate, and the copy should say so.
 */
function validateRequired(body: any): string | null {
  const { name, email, age, gender } = body;
  if (!name || typeof name !== 'string') return 'name is required';
  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) return 'a valid email is required';
  const parsedAge = Number(age);
  if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) {
    return 'age must be between 13 and 120';
  }
  // Optional, but still checked when supplied — an unrecognised value would
  // otherwise sit in the column forever and break any future typed read.
  if (gender != null && gender !== '' && !VALID_GENDERS.includes(gender)) {
    return `gender must be one of ${VALID_GENDERS.join(', ')}`;
  }
  return null;
}

profileRouter.get('/', ah(async (req, res) => {
  const profile = await prisma.userProfile.findUnique({ where: { userId: req.userId } });
  res.json(profile);
}));

profileRouter.post('/', ah(async (req, res) => {
  const body = req.body ?? {};
  const invalid = validateRequired(body);
  if (invalid) return res.status(400).json({ error: invalid });

  const existing = await prisma.userProfile.findUnique({ where: { userId: req.userId } });
  if (existing) return res.status(409).json({ error: 'A profile already exists', profile: existing });

  const profile = await prisma.userProfile.create({
    data: {
      userId: req.userId,
      name: body.name.trim(),
      email: body.email.trim(),
      age: Number(body.age),
      // Skipping the question is recorded as PREFER_NOT_TO_SAY rather than
      // left null. The column is non-nullable, and this is the one enum value
      // that already means "no answer" — so no migration is needed and the
      // stored value does not misrepresent anyone. Nothing reads this field.
      gender: body.gender || 'PREFER_NOT_TO_SAY',
      location: body.location?.trim() || null,
      phone: body.phone?.trim() || null,
      bio: body.bio?.trim() || null,
      experienceLevel: VALID_EXPERIENCE.includes(body.experienceLevel) ? body.experienceLevel : null,
      goals: body.goals?.trim() || null,
    },
  });
  emitEvent('profile.created', {});
  res.status(201).json(profile);
}));

profileRouter.patch('/:id', ah(async (req, res) => {
  const body = req.body ?? {};
  if (body.gender && !VALID_GENDERS.includes(body.gender)) {
    return res.status(400).json({ error: `gender must be one of ${VALID_GENDERS.join(', ')}` });
  }
  if (body.experienceLevel && !VALID_EXPERIENCE.includes(body.experienceLevel)) {
    return res.status(400).json({ error: `experienceLevel must be one of ${VALID_EXPERIENCE.join(', ')}` });
  }
  if (body.age !== undefined) {
    const parsedAge = Number(body.age);
    if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      return res.status(400).json({ error: 'age must be between 13 and 120' });
    }
  }
  if (body.email !== undefined && !/^\S+@\S+\.\S+$/.test(body.email)) {
    return res.status(400).json({ error: 'email must be valid' });
  }

  // Scope by userId as well as id, so one account cannot edit another's
  // profile by guessing an id.
  const owned = await prisma.userProfile.findFirst({
    where: { id: req.params.id, userId: req.userId },
    select: { id: true },
  });
  if (!owned) return res.status(404).json({ error: 'Profile not found' });

  const profile = await prisma.userProfile.update({
    where: { id: req.params.id },
    data: {
      name: body.name,
      email: body.email,
      age: body.age !== undefined ? Number(body.age) : undefined,
      gender: body.gender,
      location: body.location,
      phone: body.phone,
      bio: body.bio,
      experienceLevel: body.experienceLevel,
      goals: body.goals,
    },
  });
  emitEvent('profile.updated', {});
  res.json(profile);
}));
