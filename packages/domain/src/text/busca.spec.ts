import { describe, expect, it } from 'vitest';
import { chaveProduto, combinaBusca, combinaFuzzy, semAcento } from './busca.js';
import { aplicarSinonimos } from './sinonimos.js';

describe('semAcento', () => {
  it('remove acentos e normaliza para minúsculas', () => {
    expect(semAcento('Café')).toBe('cafe');
    expect(semAcento('Pão')).toBe('pao');
    expect(semAcento('AÇÚCAR')).toBe('acucar');
  });
});

describe('combinaBusca — acento + abreviação do cupom', () => {
  it('ignora acento e caixa nos dois sentidos', () => {
    expect(combinaBusca('CAFE 3CORACOES', 'café')).toBe(true);
    expect(combinaBusca('Café Moído', 'cafe')).toBe(true);
    expect(combinaBusca('PAO FRANCES Kg', 'pão')).toBe(true); // caso do print
    expect(combinaBusca('FEIJAO KICALDO', 'feijão')).toBe(true);
  });

  it('entende abreviações: palavra inteira acha o item abreviado', () => {
    expect(combinaBusca('SAB.LIQ.PALMOLIVE', 'sabao')).toBe(true);
    expect(combinaBusca('SAB.REXONA ANTIBAC', 'sabão')).toBe(true);
    expect(combinaBusca('DET.LIQ.LIMPOL', 'detergente')).toBe(true);
    expect(combinaBusca('BISC.TRAKINAS RECH.', 'biscoito')).toBe(true);
    expect(combinaBusca('REF.SUCO PRAT', 'refrigerante')).toBe(true);
  });

  it('mantém a precisão: não casa termo vazio nem coisas não relacionadas', () => {
    expect(combinaBusca('SAB.LIQ.PALMOLIVE', '')).toBe(false);
    expect(combinaBusca('ARROZ CAMIL', 'sabao')).toBe(false);
    // "REF." de açúcar REFinado não deve casar com "refrigerante"
    expect(combinaBusca('ACUC.REF.UNIAO', 'refrigerante')).toBe(false);
  });
});

describe('combinaFuzzy — tolera erro de digitação', () => {
  it('acha o produto mesmo com typo', () => {
    expect(combinaFuzzy('ARROZ CAMIL', 'arros')).toBe(true);
    expect(combinaFuzzy('FEIJAO KICALDO', 'fejao')).toBe(true);
    expect(combinaFuzzy('CAFE PILAO', 'caffe')).toBe(true);
  });
  it('não casa palavra curta (exige exato) nem coisa distante', () => {
    expect(combinaFuzzy('SAL REFINADO', 'sol')).toBe(false); // curta → sem fuzzy
    expect(combinaFuzzy('ARROZ CAMIL', 'sabao')).toBe(false);
  });
});

describe('aplicarSinonimos — apelidos → termo do catálogo', () => {
  it('mapeia sinônimos cross-word', () => {
    expect(aplicarSinonimos('bolacha')).toBe('biscoito');
    expect(aplicarSinonimos('xampu')).toBe('shampoo');
    expect(aplicarSinonimos('miojo')).toBe('macarrao');
  });
  it('deixa termos sem sinônimo intactos (normalizados)', () => {
    expect(aplicarSinonimos('arroz')).toBe('arroz');
    expect(aplicarSinonimos('Café')).toBe('cafe');
  });
  it('aplica sinônimos DINÂMICOS (ensinados pelo ADM)', () => {
    expect(aplicarSinonimos('zero', [['zero', 'refrigerante']])).toBe('refrigerante');
    expect(aplicarSinonimos('Nescau', [['nescau', 'achocolatado']])).toBe('achocolatado');
  });
});

describe('chaveProduto — detecção de duplicatas', () => {
  it('dá a MESMA chave pra nomes diferentes do mesmo produto', () => {
    // caso real do print (ordem diferente + ruído "U")
    expect(chaveProduto('PAO PANCO 500G FORMA')).toBe(chaveProduto('PAO FORMA PANCO 500G U'));
    // reordenação simples
    expect(chaveProduto('OLEO SOJA LIZA')).toBe(chaveProduto('OLEO LIZA SOJA'));
  });

  it('NÃO colide produtos diferentes (marca/tamanho distintos)', () => {
    expect(chaveProduto('PAO FORMA PANCO 500G')).not.toBe(chaveProduto('PAO FORMA PULLMAN'));
    expect(chaveProduto('PAO FORMA PANCO 500G')).not.toBe(chaveProduto('PAO FORMA JR 350G'));
    expect(chaveProduto('ARROZ CAMIL 5KG')).not.toBe(chaveProduto('ARROZ CAMIL 1KG'));
  });
});
