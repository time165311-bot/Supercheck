import React, { useEffect, useRef, useState } from 'react';
import operatingRoomBg from '../assets/images/modern_operating_room_1793107748862.jpg';

interface Particle {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  vx: number;
  vy: number;
  pulseSpeed: number;
  pulsePhase: number;
  isBokeh: boolean;
}

export const ParallaxBackground: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Scroll-linked Parallax 60fps tracking
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 2. Sterile OR Suite Floating Dust & Light Bokeh Particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate sterile floating dust & ambient light bokeh
    const particleCount = Math.min(Math.floor(width / 32), 48);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const isBokeh = Math.random() < 0.22; // ~22% larger soft bokeh circles
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: isBokeh ? Math.random() * 8 + 6 : Math.random() * 2 + 1.2,
        baseAlpha: isBokeh ? Math.random() * 0.14 + 0.06 : Math.random() * 0.35 + 0.15,
        alpha: 0.2,
        vx: (Math.random() - 0.45) * 0.25,
        vy: -Math.random() * 0.35 - 0.08, // gentle upward floating drift
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
        isBokeh,
      });
    }

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        // Organic Brownian motion & upward drift
        p.pulsePhase += p.pulseSpeed;
        p.x += p.vx + Math.sin(p.pulsePhase * 0.8) * 0.18;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.y < -30) {
          p.y = height + 20;
          p.x = Math.random() * width;
        }
        if (p.x < -30) p.x = width + 20;
        if (p.x > width + 30) p.x = -20;

        // Pulsing luminosity simulating surgical light reflection
        const currentAlpha = p.baseAlpha * (0.8 + 0.3 * Math.sin(p.pulsePhase));

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (p.isBokeh) {
          // Soft lens bokeh circle
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          gradient.addColorStop(0, `rgba(24, 119, 242, ${currentAlpha * 0.9})`); // Subtle Facebook Blue tint
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${currentAlpha * 0.6})`);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = gradient;
        } else {
          // Delicate sterile dust speck
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(180, 215, 255, ${currentAlpha * 0.8})`;
        }

        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Parallax offset: moves slower than foreground for natural 3D depth
  const parallaxOffset = scrollY * 0.16;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{ minHeight: '100vh', width: '100vw' }}
    >
      {/* 1. Clean Operating Room Suite with Subtle Parallax Transform */}
      <div
        className="absolute inset-0 w-full h-[125%] -top-[10%]"
        style={{
          backgroundImage: `url(${operatingRoomBg})`,
          backgroundPosition: 'center 35%',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          transform: `translate3d(0, ${-parallaxOffset}px, 0) scale(1.04)`,
          willChange: 'transform',
          transition: 'transform 0.1s cubic-bezier(0.2, 0.9, 0.3, 1)',
          filter: 'brightness(1.02) saturate(0.85) contrast(0.98)',
        }}
      />

      {/* 2. Facebook Minimal Clean Light-Gray Overlay (#F0F2F5 with 88-92% opacity) */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(240, 242, 245, 0.88) 0%, rgba(240, 242, 245, 0.93) 100%)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
      />

      {/* 3. Sterile Operating Room Floating Dust & Bokeh Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.85 }}
      />

      {/* 4. Ambient Facebook Blue Light Glow at Top Right */}
      <div
        className="absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{
          backgroundColor: '#1877F2',
          transform: `translate3d(0, ${parallaxOffset * 0.3}px, 0)`,
          willChange: 'transform',
        }}
      />
    </div>
  );
};
