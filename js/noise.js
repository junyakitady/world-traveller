/**
 * Retro Earth Explorer - Noise Module
 * High-performance 2D Value Noise and FBM generator for organic moisture mapping.
 */

class ValueNoise2D {
    constructor(seed = 12345) {
        this.seed = seed;
        this.grid = new Float32Array(512);
        this.initGrid();
    }

    initGrid() {
        // Seeded random number generator for generating the noise grid table
        let s = this.seed;
        const rand = () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280.0;
        };
        for (let i = 0; i < 512; i++) {
            this.grid[i] = rand();
        }
    }

    hash(x, y) {
        // High-quality deterministic coordinate hashing
        const idx = Math.abs((x * 31 + y * 73) ^ (x * 127 + y * 59)) % 512;
        return this.grid[idx];
    }

    noise(x, y) {
        const x0 = Math.floor(x);
        const x1 = x0 + 1;
        const y0 = Math.floor(y);
        const y1 = y0 + 1;

        const tx = x - x0;
        const ty = y - y0;

        // Smoothstep interpolation (S-curve) for organic transitions
        const u = tx * tx * (3 - 2 * tx);
        const v = ty * ty * (3 - 2 * ty);

        const n00 = this.hash(x0, y0);
        const n10 = this.hash(x1, y0);
        const n01 = this.hash(x0, y1);
        const n11 = this.hash(x1, y1);

        const nx0 = n00 * (1 - u) + n10 * u;
        const nx1 = n01 * (1 - u) + n11 * u;

        return nx0 * (1 - v) + nx1 * v;
    }

    /**
     * Fractional Brownian Motion (FBM) combining multiple octaves of noise.
     */
    fbm(x, y, octaves = 3, lacunarity = 2.0, gain = 0.5) {
        let value = 0;
        let amplitude = 0.5;
        let frequency = 1.0;
        let maxAmplitude = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.noise(x * frequency, y * frequency) * amplitude;
            maxAmplitude += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }

        return value / maxAmplitude;
    }
}

// Export for global browser context
window.ValueNoise2D = ValueNoise2D;
