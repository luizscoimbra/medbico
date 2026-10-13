// Tipos locais para bwip-js: o pacote só declara `types` sob a condição de
// `exports.browser`, que não é resolvida pelo `moduleResolution: "bundler"`.
declare module "bwip-js" {
  export interface BwipOptions {
    [chave: string]: string | number | undefined;
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    margin?: number;
    barcolor?: string;
    backgroundcolor?: string;
  }

  export function toSVG(opcoes: BwipOptions): string;

  const bwipjs: {
    toSVG: (opcoes: BwipOptions) => string;
    toCanvas: (canvas: unknown, opcoes: BwipOptions) => void;
  };

  export default bwipjs;
}
