/** Carimbo de versão do build (injetado pelo Vite via `define`). Serve para
 *  confirmar, olhando a tela, qual versão o aparelho está de fato rodando. */
declare const __BUILD_ID__: string;

/** Google Identity Services (carregado dinâmico só quando VITE_GOOGLE_CLIENT_ID existe). */
interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: {
          client_id: string;
          callback: (resp: { credential?: string }) => void;
          auto_select?: boolean;
          cancel_on_tap_outside?: boolean;
          use_fedcm_for_prompt?: boolean;
        }): void;
        renderButton(
          parent: HTMLElement,
          options: {
            type?: 'standard' | 'icon';
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'small' | 'medium' | 'large';
            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            logo_alignment?: 'left' | 'center';
            width?: number;
            locale?: string;
          },
        ): void;
        prompt(): void;
        cancel(): void;
      };
    };
  };
}
