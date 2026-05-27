import { useEffect, useRef } from 'react';

export default function HeroCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    let animationFrame;
    let width = 0;
    let height = 0;
    const pointer = { x: 0, y: 0, active: false };
    const nodes = Array.from({ length: 72 }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0007,
      vy: (Math.random() - 0.5) * 0.0007,
      r: index % 7 === 0 ? 2.2 : 1.4
    }));

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(7, 9, 13, 0.68)';
      context.fillRect(0, 0, width, height);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > 1) node.vx *= -1;
        if (node.y < 0 || node.y > 1) node.vy *= -1;
      }

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const ax = a.x * width;
          const ay = a.y * height;
          const bx = b.x * width;
          const by = b.y * height;
          const distance = Math.hypot(ax - bx, ay - by);

          if (distance < 150) {
            const alpha = (1 - distance / 150) * 0.16;
            context.strokeStyle = `rgba(103, 232, 249, ${alpha})`;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(ax, ay);
            context.lineTo(bx, by);
            context.stroke();
          }
        }
      }

      for (const node of nodes) {
        const x = node.x * width;
        const y = node.y * height;
        const pulse = pointer.active ? Math.max(0, 1 - Math.hypot(x - pointer.x, y - pointer.y) / 260) : 0;
        context.fillStyle = pulse > 0 ? `rgba(251, 191, 36, ${0.35 + pulse * 0.35})` : 'rgba(110, 231, 183, 0.55)';
        context.beginPath();
        context.arc(x, y, node.r + pulse * 2, 0, Math.PI * 2);
        context.fill();
      }

      animationFrame = requestAnimationFrame(draw);
    }

    function handlePointerMove(event) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    }

    function handlePointerLeave() {
      pointer.active = false;
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

