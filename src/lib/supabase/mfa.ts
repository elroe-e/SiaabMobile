/** True when the account has a verified second factor but this session has only passed the password step. */
export function needsSecondStep(level: { currentLevel: string | null; nextLevel: string | null } | null | undefined): boolean {
  return level?.nextLevel === 'aal2' && level.currentLevel !== 'aal2'
}
