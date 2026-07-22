import helmet from 'helmet';

const OSM_TILES = ['https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'];
/**
 * Google Identity Services (botão "Entrar com Google"). Libera o MÍNIMO: só o subpath
 * /gsi/ (script + iframe do botão/One Tap) e as fotos de avatar. Sem isso, em produção
 * (single-origin, CSP ativa) o botão simplesmente não carrega — em dev o Vite ignora a
 * CSP, então é uma pegadinha de "funciona local, quebra em prod".
 */
const GIS = 'https://accounts.google.com/gsi/';
const GIS_CLIENT = 'https://accounts.google.com/gsi/client';
const GOOGLE_AVATARS = 'https://lh3.googleusercontent.com';

/**
 * Config do helmet. CSP restritiva, mas liberando o necessário para o MapLibre
 * (tiles OSM + worker blob:) e para o botão do Google (subpath /gsi/).
 */
export const helmetOptions: Parameters<typeof helmet>[0] = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      // 'self' (nossos forms) + Google (fluxo redirect do Sign-In posta pro nosso callback).
      formAction: ["'self'", 'https://accounts.google.com'],
      frameAncestors: ["'self'"],
      frameSrc: ["'self'", GIS],
      imgSrc: ["'self'", 'data:', 'blob:', ...OSM_TILES, GOOGLE_AVATARS],
      connectSrc: ["'self'", ...OSM_TILES, GIS],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", GIS_CLIENT],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
};
