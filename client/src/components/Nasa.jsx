import { useCallback, useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export default function NasaParticles() {
  const [init, setInit] = useState(false);

  // Initialize engine once
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

    background: {
      color: "#01030a",
    },

    fpsLimit: 60,

    particles: {
      number: {
        value: 150,
        density: { enable: true, area: 800 },
      },

      color: {
        value: ["#3b82f6", "#60a5fa", "#22d3ee", "#93c5fd", "#ffffff"],
      },

      shape: {
        type: "circle",
      },

      opacity: {
        value: { min: 0.4, max: 1 },
        animation: {
          enable: true,
          speed: 1,
          sync: false,
        },
      },

      size: {
        value: { min: 1, max: 3 },
        animation: {
          enable: true,
          speed: 2,
          minimumValue: 0.5,
          sync: false,
        },
      },

      links: {
        enable: true,
        distance: 120,
        color: "#60a5fa",
        opacity: 0.3,
        width: 1,
        triangles: {
          enable: true,
          opacity: 0.04,
        },
      },

      move: {
        enable: true,
        speed: 0.7,
        random: true,

        // 🔥 FIXES EMPTY SPACE ISSUE
        outModes: {
          default: "wrap",
        },

        attract: {
          enable: true,
          rotateX: 600,
          rotateY: 1200,
        },
      },
    },

    interactivity: {
      events: {
        onHover: {
          enable: true,
          mode: ["grab", "repulse"],
        },
        onClick: {
          enable: true,
          mode: ["push"],
        },
        resize: true,
      },

      modes: {
        grab: {
          distance: 150,
          links: {
            opacity: 0.7,
          },
        },

        repulse: {
          distance: 120,
        },

        push: {
          quantity: 5,
        },
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
      fullScreen: {
        enable: true,
        zIndex: -1, // stays behind UI
      },
    }}
  />
);
}