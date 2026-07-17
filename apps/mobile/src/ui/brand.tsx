import { type CSSProperties } from 'react';
import { useTheme } from '../theme/theme';

/**
 * Operador/desenvolvedor do app. Ponto ÚNICO de verdade — quando a PJ for
 * constituída, troque aqui para "GVA Software LTDA · CNPJ 00.000.000/0001-00"
 * e os 3 rodapés (login, cadastro, Perfil) atualizam juntos.
 */
export const DESENVOLVEDOR = 'GVA Software';

/** Crédito discreto de rodapé: "Desenvolvido por GVA Software". */
export function CreditoDev({ style }: { style?: CSSProperties }) {
  const { T } = useTheme();
  return (
    <p style={{ textAlign: 'center', fontSize: 11, color: T.muted, margin: '8px 0 0', ...style }}>
      Desenvolvido por {DESENVOLVEDOR}
    </p>
  );
}
