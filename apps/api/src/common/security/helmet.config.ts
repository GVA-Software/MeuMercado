import helmet from 'helmet';

const OSM_TILES = ['https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'];

/**
 * Config do helmet. CSP restritiva, mas liberando o necessário para o MapLibre:
 * tiles do OpenStreetMap (img/connect) e o web worker do mapa (blob:).
 */
export const helmetOptions: Parameters<typeof helmet>[0] = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', ...OSM_TILES],
      connectSrc: ["'self'", ...OSM_TILES],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
};
