import { ColorSwatch, Group } from "@mantine/core";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Draggable from "react-draggable";
import { SWATCHES } from "@/constants";

interface GeneratedResult {
  expression: string;
  answer: string;
}

interface Response {
  expr: string;
  result: string;
  assign: boolean;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("rgb(255, 255, 255)");
  const [reset, setReset] = useState(false);
  const [dictOfVars, setDictOfVars] = useState({});
  const [result, setResult] = useState<GeneratedResult>();
  const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
  const [latexExpression, setLatexExpression] = useState<Array<string>>([]);

  useEffect(() => {
    if (latexExpression.length > 0 && window.MathJax) {
      setTimeout(() => {
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
      }, 0);
    }
  }, [latexExpression]);

  useEffect(() => {
    if (result) {
      renderLatexToCanvas(result.expression, result.answer);
    }
  }, [result]);

  useEffect(() => {
    if (reset) {
      resetCanvas();
      setLatexExpression([]);
      setResult(undefined);
      setDictOfVars({});
      setReset(false);
    }
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      resizeCanvas();
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineWidth = 3;
      }
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML";
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.MathJax.Hub.Config({
        tex2jax: {
          inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"],
          ],
        },
      });
    };

    window.addEventListener('resize', resizeCanvas);

    return () => {
      document.head.removeChild(script);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - canvas.offsetTop;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineWidth = 3;
      }
    }
  };

  const renderLatexToCanvas = (expression: string, answer: string) => {
    const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
    setLatexExpression([...latexExpression, latex]);

    // Clear the main canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const startDrawing = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.background = "black";
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        const { offsetX, offsetY } = getCoordinates(e);
        ctx.moveTo(offsetX, offsetY);
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = color;
        const { offsetX, offsetY } = getCoordinates(e);
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getCoordinates = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        return {
          offsetX: touch.clientX - rect.left,
          offsetY: touch.clientY - rect.top
        };
      }
    } else {
      return {
        offsetX: e.nativeEvent.offsetX,
        offsetY: e.nativeEvent.offsetY
      };
    }
    return { offsetX: 0, offsetY: 0 };
  };

  const runRoute = async () => {
    const canvas = canvasRef.current;

    if (canvas) {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/calculate`, {
        image: canvas.toDataURL("image/png"),
        dict_of_vars: dictOfVars,
      });

      const resp = await response.data;
      console.log("Response", resp);
      resp.data.forEach((data: Response) => {
        if (data.assign) {
          setDictOfVars(prev => ({
            ...prev,
            [data.expr]: data.result,
          }));
        }
      });

      const ctx = canvas.getContext("2d");
      const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width,
        minY = canvas.height,
        maxX = 0,
        maxY = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (imageData.data[i + 3] > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setLatexPosition({ x: centerX, y: centerY });
      resp.data.forEach((data: Response) => {
        setTimeout(() => {
          setResult({
            expression: data.expr,
            answer: data.result,
          });
        }, 1000);
      });
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Centered Header */}
      <div className="flex justify-center items-center h-16 bg-zinc-900">
        <h1 className="text-white text-2xl md:text-3xl" id="nameadham">Adham Hossam</h1>
      </div>

      {/* Button and Color Swatch Section */}
      <div className='grid grid-cols-3 gap-2 p-2 bg-zinc-900'>
        <Button
          onClick={() => setReset(true)}
          className='z-20 bg-zinc-900 text-white text-sm hover:bg-black md:text-base'
          variant='default' 
          color='black'
        >
          Reset
        </Button>
        <Group className='z-20 flex justify-center'>
          {SWATCHES.map((swatch) => (
            <ColorSwatch
              key={swatch}
              color={swatch}
              onClick={() => setColor(swatch)}
              size={24}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </Group>
        <Button
          onClick={runRoute}
          className='z-20 bg-zinc-900 hover:bg-black text-white text-sm md:text-base'
          variant='default'
          color='white'
        >
          Calculate
        </Button>
      </div>

      {/* Canvas Section */}
      <div className="relative flex-grow">
        <canvas
          ref={canvasRef}
          id='canvas'
          className='absolute top-0 left-0 w-full h-full touch-none'
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {latexExpression.map((latex, index) => (
          <Draggable
            key={index}
            defaultPosition={latexPosition}
            onStop={(_e, data) => setLatexPosition({ x: data.x, y: data.y })}
          >
            <div className="absolute p-2 text-white rounded shadow-md bg-zinc-800 bg-opacity-75">
              <div className="latex-content text-sm md:text-base">{latex}</div>
            </div>
          </Draggable>
        ))}
      </div>
    </div>
  );
}
