/**
 * CENTRAL — HQ-NET AI dispatch voice.
 *
 * Dropped you in the city to recover five assets. Helpful. Sarcastic.
 * Thinks humans are soft. Does not believe you will finish.
 * Dark humor only — no cheer, no “you got this, champ.”
 */

export const HQ_NAME = 'CENTRAL';
export const HQ_TAG = 'CENTRAL // HQ-NET';

/** The five recovery targets (story “why”). */
export const MISSION_FIVE = [
  { id: 'cache', name: 'Salvage Cache', hint: 'gold crate east of drop' },
  { id: 'stick', name: 'Street Stick', hint: 'south hike' },
  { id: 'hat', name: 'Neon Fedora', hint: 'west hike' },
  { id: 'bandage', name: 'Field Bandage', hint: 'craft at purple Street Rig' },
  { id: 'breach', name: 'Breach Kit', hint: 'print north in RED · then escape' },
];

/** Prefix lines so UI always reads as radio from CENTRAL. */
export function hqLine(body) {
  return body;
}

export function hqTitle(subject) {
  return `${HQ_NAME} · ${subject}`;
}
