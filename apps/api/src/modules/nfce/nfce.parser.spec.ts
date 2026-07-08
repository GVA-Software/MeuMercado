import { describe, expect, it } from 'vitest';
import { reaisParaCents, SpNfceParser } from './nfce.parser.js';

describe('reaisParaCents', () => {
  it('aceita 1 ou 2 casas decimais (SEFAZ-SP corta o zero final)', () => {
    expect(reaisParaCents('Vl. Unit.: 15,9')).toBe(1590);
    expect(reaisParaCents('Vl. Unit.: 41,77')).toBe(4177);
    expect(reaisParaCents('R$ 5,00')).toBe(500);
  });

  it('lida com milhar e sem número', () => {
    expect(reaisParaCents('1.234,56')).toBe(123456);
    expect(reaisParaCents('sem preço')).toBeNull();
  });
});

// HTML mínimo espelhando a estrutura real do portal NFC-e de SP.
const HTML_SP = `
<div class="txtTopo">MERCADO TESTE LTDA</div>
<div class="text">CNPJ: 12.345.678/0001-99</div>
<table id="tabResult">
  <tr id="Item + 1"><td valign="top">
    <span class="txtTit">ARROZ CAMIL 5KG</span><span class="RCod">(Código: 123)</span><br>
    <span class="Rqtd"><strong>Qtde.:</strong>2</span>
    <span class="RUN"><strong>UN: </strong>PCT</span>
    <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp; 24,9</span>
  </td><td class="txtTit noWrap">Vl. Total<br><span class="valor">49,80</span></td></tr>
  <tr id="Item + 2"><td valign="top">
    <span class="txtTit">FEIJAO 1KG</span><span class="RCod">(Código: 456)</span><br>
    <span class="Rqtd"><strong>Qtde.:</strong>1</span>
    <span class="RUN"><strong>UN: </strong>UND</span>
    <span class="RvlUnit"><strong>Vl. Unit.:</strong> 8,79</span>
  </td><td class="txtTit noWrap">Vl. Total<br><span class="valor">8,79</span></td></tr>
</table>`;

describe('SpNfceParser', () => {
  const parsed = new SpNfceParser().parse(HTML_SP);

  it('extrai o nome do mercado e o CNPJ', () => {
    expect(parsed.mercadoNome).toBe('MERCADO TESTE LTDA');
    expect(parsed.mercadoCnpj).toBe('12.345.678/0001-99');
  });

  it('extrai os itens com preço unitário correto (inclusive "24,9" = R$24,90) e o código do SKU', () => {
    expect(parsed.itens).toHaveLength(2);
    expect(parsed.itens[0]).toMatchObject({
      descricao: 'ARROZ CAMIL 5KG',
      codigo: '123',
      unitPriceCents: 2490,
      quantidade: 2,
    });
    expect(parsed.itens[1]).toMatchObject({
      descricao: 'FEIJAO 1KG',
      codigo: '456',
      unitPriceCents: 879,
    });
  });
});
