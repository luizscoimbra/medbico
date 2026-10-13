import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser, Fingerprint, PenLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export interface AssinaturaOSValue {
  base64: string;
  metodo: "biometrica" | "toque";
  nome: string;
}

/**
 * Bloco de assinatura do encerramento da OS.
 *
 * Quando o dispositivo tem autenticador biométrico (WebAuthn — digital/rosto),
 * a confirmação exige a biometria e o desenho vira a prova gráfica; quando não
 * tem, a assinatura é por toque no canvas. Em ambos os casos o nome do
 * assinante fica gravado junto com a imagem e o método.
 */
export function AssinaturaOS({
  value,
  onChange,
}: {
  value: AssinaturaOSValue | null;
  onChange: (v: AssinaturaOSValue | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temDesenho, setTemDesenho] = useState(false);
  const [nome, setNome] = useState(value?.nome ?? "");
  const [biometriaDisponivel, setBiometriaDisponivel] = useState(false);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  useEffect(() => {
    void PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setBiometriaDisponivel)
      .catch(() => setBiometriaDisponivel(false));
  }, []);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const iniciar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDesenhando(true);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!temDesenho) setTemDesenho(true);
  };

  const parar = () => setDesenhando(false);

  const limpar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemDesenho(false);
    onChange(null);
  };

  const exportar = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !temDesenho) return null;
    // Fundo branco antes de exportar (a assinatura vira anexo em PDF/OS).
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    return canvas.toDataURL("image/png");
  };

  const aplicar = (metodo: "biometrica" | "toque") => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      toast.error("Informe o nome de quem está assinando");
      return;
    }
    const base64 = exportar();
    if (!base64) {
      toast.error("Desenhe a assinatura antes de confirmar");
      return;
    }
    onChange({ base64, metodo, nome: nomeLimpo });
  };

  const confirmarBiometria = async () => {
    if (verificando) return;
    setVerificando(true);
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: "required",
          timeout: 60_000,
        },
      });
      aplicar("biometrica");
    } catch (e) {
      const nomeErro = (e as Error)?.name ?? "";
      if (nomeErro === "NotAllowedError") {
        toast.error("Biometria cancelada ou não autorizada");
      } else {
        toast.error("Não foi possível confirmar com a biometria");
      }
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <PenLine className="h-4 w-4 text-primary" /> Assinatura do encerramento
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={limpar} disabled={!temDesenho}>
          <Eraser className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assinatura_nome" className="text-xs text-muted-foreground">
          Quem assina (nome completo)
        </Label>
        <Input
          id="assinatura_nome"
          placeholder="Ex: João da Silva"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="h-9"
        />
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={parar}
        onPointerLeave={parar}
        className="w-full h-36 rounded-lg border-2 border-dashed border-border bg-white touch-none cursor-crosshair"
        style={{ display: "block" }}
      />
      <p className="text-xs text-muted-foreground -mt-1">
        Assine com o dedo ou caneta sobre a área acima.
      </p>

      <div className="flex flex-wrap gap-2">
        {biometriaDisponivel ? (
          <Button
            type="button"
            onClick={confirmarBiometria}
            disabled={verificando || !temDesenho || !nome.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Fingerprint className="h-4 w-4 mr-2" />
            {verificando ? "Confirme no dispositivo..." : "Confirmar com biometria"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sem sensor biométrico neste dispositivo — use a assinatura por toque.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => aplicar("toque")}
          disabled={!temDesenho || !nome.trim()}
        >
          <PenLine className="h-4 w-4 mr-2" /> Assinar por toque
        </Button>
      </div>

      {value && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            Assinado por <strong>{value.nome}</strong> — método:{" "}
            <strong>{value.metodo === "biometrica" ? "biométrico" : "por toque"}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
