import { useCallback, useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export default function NasaParticles() {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const particlesLoaded = useCallback((container) => {
    console.log("Particles loaded:", container);
  }, []);

  const options = useMemo(() => ({
    fullScreen: { enable: false },

    background: { color: "#01030a" },

    fpsLimit: 120, // smoother animation

    particles: {
      number: { value: 300, density: { enable: true, area: 800 } }, // more particles

      color: {
        value: ["#3b82f6", "#60a5fa", "#22d3ee", "#93c5fd", "#ffffff", "#facc15", "#f472b6"]
      },

      shape: { type: "circle" },

      opacity: {
        value: { min: 0.3, max: 1 },
        animation: { enable: true, speed: 1.5, sync: false },
      },

      size: {
        value: { min: 1, max: 5 },
        animation: { enable: true, speed: 3, minimumValue: 0.3, sync: false },
      },

      links: {
        enable: true,
        distance: 140,
        color: "#60a5fa",
        opacity: 0.4,
        width: 1.5,
        triangles: { enable: true, opacity: 0.08 },
      },

      move: {
        enable: true,
        speed: 1.2, // faster movement
        random: true,
        outModes: { default: "wrap" },
        attract: { enable: true, rotateX: 600, rotateY: 1200 },
      },
    },

    interactivity: {
      events: {
        onHover: { enable: true, mode: ["grab", "repulse"] },
        onClick: { enable: true, mode: ["push", "remove"] },
        resize: true,
      },
      modes: {
        grab: { distance: 180, links: { opacity: 0.8 } },
        repulse: { distance: 150 },
        push: { quantity: 8 },
        remove: { quantity: 5 },
      },
    },

    detectRetina: true,
  }), []);

  if (!init) return null;

  return (
    <Particles
      id="nasa-particles"
      particlesLoaded={particlesLoaded}
      options={{
        ...options,
        fullScreen: { enable: true, zIndex: -1 },
      }}
    />
  );
}