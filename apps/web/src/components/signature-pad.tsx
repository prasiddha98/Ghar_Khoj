import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, RotateCcw, Copy } from "lucide-react";

interface SignaturePadProps {
  onSignatureCapture: (signature: string) => void;
  mode?: "canvas" | "typed";
}

export function SignaturePad({ onSignatureCapture, mode = "typed" }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    if (mode !== "canvas") return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = 500;
    canvas.height = 150;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [mode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== "canvas") return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || mode !== "canvas") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const captureSignature = () => {
    if (mode === "canvas") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const signature = canvas.toDataURL("image/png");
      onSignatureCapture(signature);
    } else {
      if (typedName.trim()) {
        onSignatureCapture(typedName.trim());
      }
    }
  };

  if (mode === "typed") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Your Full Legal Name</label>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Enter your full name as it appears on your ID"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            By signing, you legally agree to the terms of this contract.
          </p>
        </div>
        <Button
          onClick={captureSignature}
          disabled={!typedName.trim()}
          className="w-full rounded-lg"
        >
          Sign Contract
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-2">Draw Your Signature</label>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full border-2 border-dashed border-muted-foreground rounded-lg cursor-crosshair bg-white"
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          className="flex-1 rounded-lg"
        >
          <RotateCcw size={14} className="mr-2" /> Clear
        </Button>
        <Button
          onClick={captureSignature}
          size="sm"
          className="flex-1 rounded-lg"
        >
          <Copy size={14} className="mr-2" /> Confirm Signature
        </Button>
      </div>
    </div>
  );
}
