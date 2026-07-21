import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { emitEvent } from '../core/events';

export const profileRouter = Router();

const VALID_GENDERS = ['WOMAN', 'MAN', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY'];
const VALID_EXPERIENCE = ['FIRST_TIME', 'SOME_EXPERIENCE', 'EXPERIENCED'];

function validateRequired(body: any): string | null {
  const { name, email, age, gender } = body;
  if (!name || typeof name !== 'string') return 'name is required';
  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) return 'a valid email is required';
  const parsedAge = Number(age);
  if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) return 'age must be between 13 and 120';
  if (!gender || !VALID_GENDERS.includes(gender)) return `gender must be one of ${VALID_GENDERS.join(', ')}`;
  return null;
}

profileRouter.get('/', ah(async (_req, res) => {
  const profile = await prisma.userProfile.findFirst();
  res.json(profile);
}));

profileRouter.post('/', ah(async (req, res) => {
  const body = req.body ?? {};
  const invalid = validateRequired(body);
  if (invalid) return res.status(400).json({ error: invalid });

  const existing = await prisma.userProfile.findFirst();
  if (existing) return res.status(409).json({ error: 'A profile already exists', profile: existing });

  const profile = await prisma.userProfile.create({
    data: {
      name: body.name.trim(),
      email: body.email.trim(),
      age: Number(body.age),
      gender: body.gender,
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
