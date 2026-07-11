/**
 * Flag de "já viu as boas-vindas" (por aparelho). O onboarding é uma tela única
 * de primeira abertura — não bloqueia reabertura depois.
 */
const KEY = 'mm-onboarding-v1';

export function onboardingVisto(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage indisponível → não insiste
  }
}

export function marcarOnboardingVisto(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignora */
  }
}
