const BASE = 'https://meumercado-prod.onrender.com/api';
const j = async (r) => {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};
const up = async () => {
  try {
    return (
      (await j(await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(30000) }))).uptime ??
      null
    );
  } catch {
    return null;
  }
};
let prev = null,
  live = false;
for (let i = 1; i <= 20; i++) {
  const u = await up();
  if (u !== null) {
    if (prev !== null && u < prev - 5) {
      live = true;
      console.log(`deploy novo (uptime ${prev.toFixed(0)}->${u.toFixed(0)}s)`);
      break;
    }
    console.log(`t${i}: uptime ${u.toFixed(0)}s`);
    prev = u;
  }
  await new Promise((r) => setTimeout(r, 20000));
}
if (!live) console.log('(sem restart claro — testando assim mesmo)');
const tok = (
  await j(
    await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'persist@example.com', senha: 'senha-forte-999' }),
    }),
  )
).accessToken;
const url =
  'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=35260693209765063704655050000592761048579174%7C2%7C1%7C1%7C1697CCB6C49FFCAEB4BAD4CDFAB92D76578082D8';
const d = await j(
  await fetch(`${BASE}/nfce/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
    body: JSON.stringify({ url }),
  }),
);
console.log('\nPREVIEW da sua nota (da IP do Render):');
console.log('  mercadoNome (fantasia):', d.mercadoNome);
console.log('  endereço:', d.mercadoEndereco);
console.log('  coordenada:', d.mercadoLat, d.mercadoLng);
console.log('  itens:', d.itens?.length);
console.log(
  d.mercadoNome === 'ATACADAO'
    ? '✓ nome fantasia = Atacadão (CNPJ funcionou!)'
    : `(nome: ${d.mercadoNome})`,
);
console.log(
  d.mercadoLat ? '✓ geocode funcionou (tem coordenada)' : '⚠ sem coordenada (geocode não achou)',
);
