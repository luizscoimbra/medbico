import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { buscarAgrofit, type ProdutoAgrofit } from "@/lib/fieldVisitStorage";

/**
 * Campo "Produto" com busca incremental na base oficial Agrofit/MAPA.
 *
 * Enquanto o usuário digita (debounce de 300 ms), o sistema consulta os
 * produtos registrados pelo nome comercial, registro ou ingrediente ativo e
 * ao selecionar preenche automaticamente registro MAPA, ingredientes ativos,
 * formulação e titular — dados legais exigidos no receituário.
 *
 * Quando o item tem cultura/alvo (vindo da visita), a busca é restrita a
 * produtos registrados para aquela combinação; sem resultado, cai para a
 * busca livre e avisa que o filtro foi retirado.
 */
export function ProdutoAgrofitInput({
  id,
  value,
  cultura,
  alvo,
  disabled,
  autoFocus,
  placeholder,
  onTextoChange,
  onSelecionar,
}: {
  id?: string;
  value: string;
  cultura?: string;
  alvo?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  onTextoChange: (texto: string) => void;
  onSelecionar: (produto: ProdutoAgrofit) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProdutoAgrofit[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [semFiltroCultura, setSemFiltroCultura] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);

  // Fecha o resultado ao clicar fora do campo.
  useEffect(() => {
    if (!aberto) return;
    const clicarFora = (e: MouseEvent) => {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", clicarFora);
    return () => document.removeEventListener("mousedown", clicarFora);
  }, [aberto]);

  // Busca incremental com debounce.
  useEffect(() => {
    const termoLimpo = termo.trim();
    if (termoLimpo.length < 2) {
      setAberto(false);
      setResultados([]);
      setSemFiltroCultura(false);
      return;
    }
    let cancelado = false;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        let achados = await buscarAgrofit({
          busca: termoLimpo,
          cultura,
          alvo,
          limite: 12,
        });
        let fallback = false;
        if (achados.length === 0 && (cultura || alvo)) {
          achados = await buscarAgrofit({ busca: termoLimpo, limite: 12 });
          fallback = true;
        }
        if (cancelado) return;
        setResultados(achados);
        setSemFiltroCultura(fallback);
        setAtivo(-1);
        setAberto(true);
      } catch {
        if (!cancelado) {
          setResultados([]);
          setSemFiltroCultura(false);
          setAberto(true);
        }
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [termo, cultura, alvo]);

  const selecionar = (produto: ProdutoAgrofit) => {
    onSelecionar(produto);
    setTermo("");
    setResultados([]);
    setSemFiltroCultura(false);
    setAberto(false);
    setAtivo(-1);
  };

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setAberto(false);
      return;
    }
    if (!aberto || resultados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => (a + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => (a <= 0 ? resultados.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selecionar(resultados[ativo >= 0 ? ativo : 0]);
    }
  };

  return (
    <div ref={raizRef} className="relative">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder ?? "Digite o nome do produto..."}
        onChange={(e) => {
          onTextoChange(e.target.value);
          setTermo(e.target.value);
        }}
        onFocus={() => {
          if (resultados.length > 0 && termo.trim().length >= 2) setAberto(true);
        }}
        onKeyDown={aoTeclar}
        role="combobox"
        aria-expanded={aberto}
        autoComplete="off"
      />

      {(buscando || aberto) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-md">
          {buscando ? (
            <p className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Buscando na base Agrofit...
            </p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Nenhum produto encontrado na base Agrofit.
            </p>
          ) : (
            <>
              {semFiltroCultura && (
                <p className="px-3 pt-2 text-[10px] text-amber-700">
                  Sem registro para a cultura/alvo deste item — exibindo
                  resultados sem esse filtro.
                </p>
              )}
              <ul className="max-h-56 overflow-y-auto py-1">
                {resultados.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selecionar(p)}
                      onMouseEnter={() => setAtivo(i)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        i === ativo ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                    >
                      <span className="font-medium">{p.marcaComercial}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        · Reg. {p.nrRegistro}
                      </span>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {p.ingredienteAtivo}
                        {p.formulacao ? ` · ${p.formulacao}` : ""}
                        {p.titular ? ` · ${p.titular}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="px-3 pb-1.5 pt-1 border-t text-[10px] text-muted-foreground flex items-center gap-1">
                <Search className="h-3 w-3 shrink-0" />
                Base oficial Agrofit/MAPA — selecione para preencher registro,
                ingredientes ativos e titular.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
