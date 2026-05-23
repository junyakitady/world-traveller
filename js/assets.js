/**
 * Retro Earth Explorer - Assets Module (2D Pixel-Art Engine)
 * Generates dynamic pixel-art canvases for all biomes, decorations, and Hero frames.
 * Pre-renders and caches native HTML canvases for high-performance 2D rendering.
 */

const Assets = (() => {
    // Shared color palette for all sprites
    const PALETTE = {
        transparent: 'rgba(0, 0, 0, 0)',
        outline: '#141210',
        white: '#ffffff',
        skin: '#fbcfe8',
        skinShadow: '#f472b6',
        hair: '#facc15',
        hairShadow: '#ca8a04',
        armor: '#3b82f6',
        armorDark: '#1d4ed8',
        cape: '#ef4444',
        capeDark: '#b91c1c',
        boots: '#7c2d12',
        shield: '#ea580c',
        shieldLight: '#f97316',
        sword: '#cbd5e1',
        swordHilt: '#fbbf24',
        
        // Biome base colors
        plains: '#22c55e',
        plainsDark: '#15803d',
        forest: '#15803d',
        forestDark: '#166534',
        hillBase: '#854d0e',
        hillGrass: '#22c55e',
        rock: '#64748b',
        rockDark: '#475569',
        snow: '#f8fafc',
        snowShadow: '#cbd5e1',
        desert: '#facc15',
        desertDune: '#eab308',
        deepSea: '#1e3a8a',
        shallowSea: '#0284c7',
        coralBase: '#14b8a6',
        coralNeon: '#ec4899'
    };

    // Cache of pre-compiled HTML Canvas elements
    const canvasCache = {};

    /**
     * Helper to draw a pixel block on a canvas context.
     */
    function drawPixel(ctx, x, y, color, scale = 1) {
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
    }

    return {
        PALETTE,

        /**
         * Draws a 16x16 tile pattern representing a specific biome onto a canvas.
         */
        drawTerrainTile(ctx, tileType, tx, ty, tileSize, waveFrame = 0) {
            const scale = tileSize / 16;
            ctx.clearRect(tx * tileSize, ty * tileSize, tileSize, tileSize);

            let baseColor = PALETTE.plains;
            if (tileType === 'deepSea') baseColor = PALETTE.deepSea;
            else if (tileType === 'shallowSea') baseColor = PALETTE.shallowSea;
            else if (tileType === 'coralReef') baseColor = PALETTE.coralBase;
            else if (tileType === 'plains') baseColor = PALETTE.plains;
            else if (tileType === 'forest') baseColor = PALETTE.forest;
            else if (tileType === 'walkableHills') baseColor = PALETTE.plains;
            else if (tileType === 'impassableMountains') baseColor = PALETTE.rockDark;
            else if (tileType === 'snowfield') baseColor = PALETTE.snow;
            else if (tileType === 'desert') baseColor = PALETTE.desert;
            else if (tileType === 'megalopolis' || tileType === 'village') baseColor = '#64748b';

            ctx.fillStyle = baseColor;
            ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);

            const drawLocalPixel = (px, py, color) => {
                ctx.fillStyle = color;
                ctx.fillRect(tx * tileSize + px * scale, ty * tileSize + py * scale, scale, scale);
            };

            const seed = (tx * 17 + ty * 31) % 100;

            if (tileType === 'deepSea') {
                // Wave animations logic (2-frame cycle)
                const waveY = (waveFrame === 0) ? 4 : 11;
                const waveColor = 'rgba(255, 255, 255, 0.07)';
                for (let px = 0; px < 16; px++) {
                    if ((px + waveFrame * 3) % 8 < 3) {
                        drawLocalPixel(px, waveY, waveColor);
                    }
                }
            }
            else if (tileType === 'shallowSea') {
                // Wave peaks scrolling
                const waveY = (waveFrame === 0) ? 7 : (waveFrame === 1) ? 3 : 12;
                const waveColor = 'rgba(255, 255, 255, 0.14)';
                for (let px = 0; px < 16; px++) {
                    if ((px - waveFrame * 2 + 16) % 6 < 2) {
                        drawLocalPixel(px, waveY, waveColor);
                    }
                }
            }
            else if (tileType === 'coralReef') {
                // Colored reef pixels visible below water surface
                const spots = [
                    {x: 3, y: 4, c: PALETTE.coralNeon}, {x: 4, y: 4, c: PALETTE.coralNeon},
                    {x: 11, y: 11, c: '#a855f7'}, {x: 12, y: 12, c: '#a855f7'},
                    {x: 12, y: 3, c: '#fb923c'}, {x: 6, y: 9, c: '#f43f5e'}
                ];
                spots.forEach(s => drawLocalPixel(s.x, s.y, s.c));

                // Wave pattern lines
                const pulseColor = 'rgba(255, 255, 255, 0.1)';
                const pxY = (waveFrame === 0) ? 2 : 13;
                drawLocalPixel(2, pxY, pulseColor);
                drawLocalPixel(10, (pxY + 5) % 16, pulseColor);
            }
            else if (tileType === 'plains') {
                if (seed < 30) {
                    drawLocalPixel(3, 4, PALETTE.plainsDark);
                    drawLocalPixel(3, 5, PALETTE.plainsDark);
                    drawLocalPixel(12, 11, PALETTE.plainsDark);
                } else if (seed < 60) {
                    drawLocalPixel(7, 8, PALETTE.plainsDark);
                    drawLocalPixel(8, 7, PALETTE.plainsDark);
                }
            }
            else if (tileType === 'forest') {
                // Leaf ground shadow specks
                drawLocalPixel(1, 2, PALETTE.forestDark);
                drawLocalPixel(12, 4, PALETTE.forestDark);
                drawLocalPixel(5, 11, PALETTE.forestDark);
                drawLocalPixel(9, 13, PALETTE.forestDark);
            }
            else if (tileType === 'walkableHills') {
                // Earth base mounds texture
                if (seed < 50) {
                    drawLocalPixel(2, 9, PALETTE.hillBase);
                    drawLocalPixel(3, 8, PALETTE.hillBase);
                    drawLocalPixel(4, 9, PALETTE.hillBase);
                } else {
                    drawLocalPixel(10, 11, PALETTE.hillBase);
                    drawLocalPixel(11, 10, PALETTE.hillBase);
                    drawLocalPixel(12, 11, PALETTE.hillBase);
                }
            }
            else if (tileType === 'impassableMountains') {
                // Rock split cracks texture
                drawLocalPixel(3, 3, PALETTE.rock);
                drawLocalPixel(4, 4, PALETTE.rock);
                drawLocalPixel(11, 9, PALETTE.rock);
                drawLocalPixel(12, 10, PALETTE.rock);
            }
            else if (tileType === 'snowfield') {
                if (seed < 40) {
                    drawLocalPixel(2, 3, PALETTE.snowShadow);
                    drawLocalPixel(11, 9, PALETTE.snowShadow);
                } else {
                    drawLocalPixel(7, 7, PALETTE.snowShadow);
                }
            }
            else if (tileType === 'desert') {
                // Sand dunelines
                drawLocalPixel(3, 3, PALETTE.desertDune);
                drawLocalPixel(4, 4, PALETTE.desertDune);
                drawLocalPixel(5, 4, PALETTE.desertDune);
                
                drawLocalPixel(10, 11, PALETTE.desertDune);
                drawLocalPixel(11, 12, PALETTE.desertDune);
                drawLocalPixel(12, 12, PALETTE.desertDune);
            }
            else if (tileType === 'megalopolis' || tileType === 'village') {
                // Draw cobblestone paving joints
                ctx.fillStyle = '#475569';
                ctx.fillRect(tx * tileSize, ty * tileSize + 15 * scale, tileSize, scale);
                ctx.fillRect(tx * tileSize + 15 * scale, ty * tileSize, scale, tileSize);
                ctx.fillRect(tx * tileSize, ty * tileSize + 7 * scale, tileSize, scale);
                ctx.fillRect(tx * tileSize + 7 * scale, ty * tileSize, scale, tileSize);
                
                // Add individual lighter concrete stones
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(tx * tileSize + 1 * scale, ty * tileSize + 1 * scale, 5 * scale, 5 * scale);
                ctx.fillRect(tx * tileSize + 9 * scale, ty * tileSize + 9 * scale, 5 * scale, 5 * scale);
            }
        },

        /**
         * Compiles a standard HTML Canvas for a raw pixel-art billboard decoration.
         */
        createBillboardCanvas(type, pixelScale = 2) {
            const canvas = document.createElement('canvas');
            
            // Layout size adjustments: Trees are tall (16x24), Mountains are big (32x32), others 16x16
            let w = 16, h = 16;
            if (type === 'forest_tree' || type === 'snow_tree' || type === 'hill_rock') {
                w = 16; h = 24;
            } else if (type === 'mountain_peak') {
                w = 24; h = 24;
            }

            canvas.width = w * pixelScale;
            canvas.height = h * pixelScale;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            const p = PALETTE;

            if (type === 'forest_tree') {
                // Tall 16x24 JRPG Pine (Trunk base Y=22, leaves 1px bottom safe margin to prevent sea leakage!)
                // Trunk
                ctx.fillStyle = p.boots;
                ctx.fillRect(7 * pixelScale, 15 * pixelScale, 2 * pixelScale, 7 * pixelScale);

                // Canopy layers (Foliage)
                ctx.fillStyle = p.forest;
                // Bottom foliage tier (Y=10 to 15)
                ctx.fillRect(2 * pixelScale, 10 * pixelScale, 12 * pixelScale, 6 * pixelScale);
                ctx.fillRect(3 * pixelScale, 9 * pixelScale, 10 * pixelScale, 8 * pixelScale);
                // Middle foliage tier (Y=5 to 9)
                ctx.fillRect(4 * pixelScale, 5 * pixelScale, 8 * pixelScale, 5 * pixelScale);
                ctx.fillRect(5 * pixelScale, 4 * pixelScale, 6 * pixelScale, 7 * pixelScale);
                // Top foliage tier (Y=1 to 4)
                ctx.fillRect(6 * pixelScale, 1 * pixelScale, 4 * pixelScale, 4 * pixelScale);
                ctx.fillRect(7 * pixelScale, 0 * pixelScale, 2 * pixelScale, 6 * pixelScale);

                // Shading (Bottom-right shadow layers)
                ctx.fillStyle = p.forestDark;
                ctx.fillRect(9 * pixelScale, 12 * pixelScale, 4 * pixelScale, 3 * pixelScale);
                ctx.fillRect(10 * pixelScale, 10 * pixelScale, 2 * pixelScale, 2 * pixelScale);
                ctx.fillRect(8 * pixelScale, 7 * pixelScale, 3 * pixelScale, 3 * pixelScale);
                ctx.fillRect(9 * pixelScale, 5 * pixelScale, 2 * pixelScale, 2 * pixelScale);
                ctx.fillRect(8 * pixelScale, 2 * pixelScale, 1 * pixelScale, 2 * pixelScale);

                // Highlights
                ctx.fillStyle = p.plains;
                ctx.fillRect(3 * pixelScale, 10 * pixelScale, 2 * pixelScale, 2 * pixelScale);
                ctx.fillRect(4 * pixelScale, 5 * pixelScale, 2 * pixelScale, 2 * pixelScale);
                ctx.fillRect(6 * pixelScale, 1 * pixelScale, 1 * pixelScale, 2 * pixelScale);

                // Red apples!
                ctx.fillStyle = p.cape;
                ctx.fillRect(4 * pixelScale, 12 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(11 * pixelScale, 11 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(6 * pixelScale, 7 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(9 * pixelScale, 3 * pixelScale, 1 * pixelScale, 1 * pixelScale);
            }
            else if (type === 'snow_tree') {
                // Tall 16x24 Snowy Pine (Trunk base Y=22, leaves 1px bottom safe margin!)
                // Trunk
                ctx.fillStyle = p.boots;
                ctx.fillRect(7 * pixelScale, 15 * pixelScale, 2 * pixelScale, 7 * pixelScale);

                const pineTeal = '#0f766e';
                const pineTealDark = '#115e59';

                // Canopy layers
                ctx.fillStyle = pineTeal;
                ctx.fillRect(2 * pixelScale, 10 * pixelScale, 12 * pixelScale, 6 * pixelScale);
                ctx.fillRect(3 * pixelScale, 9 * pixelScale, 10 * pixelScale, 8 * pixelScale);
                ctx.fillRect(4 * pixelScale, 5 * pixelScale, 8 * pixelScale, 5 * pixelScale);
                ctx.fillRect(5 * pixelScale, 4 * pixelScale, 6 * pixelScale, 7 * pixelScale);
                ctx.fillRect(6 * pixelScale, 1 * pixelScale, 4 * pixelScale, 4 * pixelScale);
                ctx.fillRect(7 * pixelScale, 0 * pixelScale, 2 * pixelScale, 6 * pixelScale);

                // Shading
                ctx.fillStyle = pineTealDark;
                ctx.fillRect(9 * pixelScale, 12 * pixelScale, 4 * pixelScale, 3 * pixelScale);
                ctx.fillRect(8 * pixelScale, 7 * pixelScale, 3 * pixelScale, 3 * pixelScale);
                ctx.fillRect(8 * pixelScale, 2 * pixelScale, 1 * pixelScale, 2 * pixelScale);

                // Snowy caps details
                ctx.fillStyle = p.snow;
                ctx.fillRect(7 * pixelScale, 0 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                ctx.fillRect(6 * pixelScale, 1 * pixelScale, 4 * pixelScale, 1 * pixelScale);
                ctx.fillRect(5 * pixelScale, 4 * pixelScale, 6 * pixelScale, 1 * pixelScale);
                ctx.fillRect(6 * pixelScale, 5 * pixelScale, 4 * pixelScale, 1 * pixelScale);
                ctx.fillRect(3 * pixelScale, 9 * pixelScale, 10 * pixelScale, 1 * pixelScale);
                ctx.fillRect(4 * pixelScale, 10 * pixelScale, 8 * pixelScale, 1 * pixelScale);

                // Snow Shadows
                ctx.fillStyle = p.snowShadow;
                ctx.fillRect(8 * pixelScale, 1 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                ctx.fillRect(8 * pixelScale, 5 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                ctx.fillRect(9 * pixelScale, 10 * pixelScale, 3 * pixelScale, 1 * pixelScale);
            }
            else if (type === 'desert_cactus') {
                const cGreen = '#16a34a';
                const cGreenDark = '#15803d';
                const cNeedle = '#fef08a';

                // Main vertical trunk
                ctx.fillStyle = cGreen;
                ctx.fillRect(7 * pixelScale, 2 * pixelScale, 2 * pixelScale, 14 * pixelScale);
                
                // Left arm
                ctx.fillRect(4 * pixelScale, 6 * pixelScale, 3 * pixelScale, 2 * pixelScale);
                ctx.fillRect(4 * pixelScale, 3 * pixelScale, 2 * pixelScale, 3 * pixelScale);
                
                // Right arm
                ctx.fillRect(9 * pixelScale, 8 * pixelScale, 3 * pixelScale, 2 * pixelScale);
                ctx.fillRect(10 * pixelScale, 5 * pixelScale, 2 * pixelScale, 3 * pixelScale);

                // Shadows
                ctx.fillStyle = cGreenDark;
                ctx.fillRect(8 * pixelScale, 2 * pixelScale, 1 * pixelScale, 14 * pixelScale);
                ctx.fillRect(5 * pixelScale, 3 * pixelScale, 1 * pixelScale, 5 * pixelScale);
                ctx.fillRect(11 * pixelScale, 5 * pixelScale, 1 * pixelScale, 5 * pixelScale);

                // Needles!
                ctx.fillStyle = cNeedle;
                drawPixel(ctx, 8, 3, cNeedle, pixelScale);
                drawPixel(ctx, 7, 6, cNeedle, pixelScale);
                drawPixel(ctx, 8, 9, cNeedle, pixelScale);
                drawPixel(ctx, 7, 12, cNeedle, pixelScale);
                drawPixel(ctx, 4, 4, cNeedle, pixelScale);
                drawPixel(ctx, 11, 6, cNeedle, pixelScale);
            }
            else if (type === 'hill_rock') {
                // Variegated Green-and-Brown JRPG Mountain Spire (Stands from bottom boundary Y=23 up to Y=2!)
                // 1. Earth base slope mound (Y=15 to 23, bottom-aligned)
                ctx.fillStyle = p.hillBase;
                ctx.fillRect(1 * pixelScale, 15 * pixelScale, 14 * pixelScale, 9 * pixelScale);
                ctx.fillRect(2 * pixelScale, 12 * pixelScale, 12 * pixelScale, 12 * pixelScale);
                ctx.fillRect(4 * pixelScale, 9 * pixelScale, 8 * pixelScale, 15 * pixelScale);

                // Variegated green moss patches on slope base
                ctx.fillStyle = p.forest;
                ctx.fillRect(2 * pixelScale, 16 * pixelScale, 4 * pixelScale, 4 * pixelScale);
                ctx.fillRect(10 * pixelScale, 17 * pixelScale, 3 * pixelScale, 4 * pixelScale);
                ctx.fillStyle = p.plains;
                ctx.fillRect(3 * pixelScale, 15 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                ctx.fillRect(11 * pixelScale, 16 * pixelScale, 2 * pixelScale, 1 * pixelScale);

                // 2. Rugged rock spire column (Y=6 to 14, grey rock)
                ctx.fillStyle = p.rock;
                ctx.fillRect(3 * pixelScale, 8 * pixelScale, 10 * pixelScale, 8 * pixelScale);
                ctx.fillRect(5 * pixelScale, 4 * pixelScale, 6 * pixelScale, 5 * pixelScale);

                // Shaded right half of rock column
                ctx.fillStyle = p.rockDark;
                ctx.fillRect(8 * pixelScale, 8 * pixelScale, 5 * pixelScale, 8 * pixelScale);
                ctx.fillRect(8 * pixelScale, 4 * pixelScale, 3 * pixelScale, 5 * pixelScale);

                // 3. Variegated moss highlights & vegetation steps on spires
                ctx.fillStyle = p.forest;
                ctx.fillRect(4 * pixelScale, 9 * pixelScale, 2 * pixelScale, 2 * pixelScale);
                ctx.fillRect(9 * pixelScale, 7 * pixelScale, 3 * pixelScale, 2 * pixelScale);
                ctx.fillStyle = p.plains;
                ctx.fillRect(4 * pixelScale, 8 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                ctx.fillRect(9 * pixelScale, 6 * pixelScale, 3 * pixelScale, 1 * pixelScale);

                // 4. Upper peak dome with moss cap (Y=2 to 3)
                ctx.fillStyle = p.plains;
                ctx.fillRect(6 * pixelScale, 2 * pixelScale, 4 * pixelScale, 2 * pixelScale);
                ctx.fillStyle = p.forest;
                ctx.fillRect(8 * pixelScale, 3 * pixelScale, 2 * pixelScale, 1 * pixelScale);

                // 5. Deep cracks and outlines
                ctx.fillStyle = p.outline;
                ctx.fillRect(7 * pixelScale, 6 * pixelScale, 1 * pixelScale, 4 * pixelScale);
                ctx.fillRect(8 * pixelScale, 11 * pixelScale, 1 * pixelScale, 5 * pixelScale);
            }
            else if (type === 'mountain_peak') {
                // Pure 24x24 scale mountain peak (2/3 size! Stands flat at bottom edge Y=23)
                const mid = 12;
                const peakY = 3;
                for (let y = peakY; y < 24; y++) {
                    const dy = y - peakY;
                    const width = Math.floor(dy * 1.05);
                    const left = mid - Math.floor(width / 2);

                    // Left rock side (Light)
                    ctx.fillStyle = p.rock;
                    ctx.fillRect(left * pixelScale, y * pixelScale, (mid - left) * pixelScale, pixelScale);

                    // Right rock side (Shadow)
                    ctx.fillStyle = p.rockDark;
                    ctx.fillRect(mid * pixelScale, y * pixelScale, (left + width - mid) * pixelScale, pixelScale);
                }

                // Snowcap overlay (from peak down to y=11, 8px high)
                for (let y = peakY; y < 11; y++) {
                    const dy = y - peakY;
                    const width = Math.floor(dy * 1.05);
                    const left = mid - Math.floor(width / 2);

                    // Left snow side
                    ctx.fillStyle = p.snow;
                    ctx.fillRect(left * pixelScale, y * pixelScale, (mid - left) * pixelScale, pixelScale);

                    // Right snow side
                    ctx.fillStyle = p.snowShadow;
                    ctx.fillRect(mid * pixelScale, y * pixelScale, (left + width - mid) * pixelScale, pixelScale);
                }

                // Jagged stone cracks (perfectly scaled for 24x24)
                ctx.fillStyle = p.outline;
                ctx.fillRect(11 * pixelScale, 13 * pixelScale, 1 * pixelScale, 4 * pixelScale);
                ctx.fillRect(12 * pixelScale, 17 * pixelScale, 1 * pixelScale, 2 * pixelScale);
                ctx.fillRect(13 * pixelScale, 15 * pixelScale, 1 * pixelScale, 2 * pixelScale);
            }
            else if (type === 'grass_tuft') {
                ctx.fillStyle = p.plainsDark;
                ctx.fillRect(7 * pixelScale, 11 * pixelScale, 1 * pixelScale, 5 * pixelScale);
                ctx.fillRect(6 * pixelScale, 13 * pixelScale, 1 * pixelScale, 3 * pixelScale);
                ctx.fillRect(8 * pixelScale, 12 * pixelScale, 1 * pixelScale, 4 * pixelScale);
                
                ctx.fillRect(3 * pixelScale, 13 * pixelScale, 1 * pixelScale, 3 * pixelScale);
                ctx.fillRect(4 * pixelScale, 12 * pixelScale, 1 * pixelScale, 4 * pixelScale);
                
                ctx.fillRect(11 * pixelScale, 12 * pixelScale, 1 * pixelScale, 4 * pixelScale);
            }
            else if (type === 'coral_plant') {
                ctx.fillStyle = p.coralNeon;
                ctx.fillRect(7 * pixelScale, 6 * pixelScale, 2 * pixelScale, 10 * pixelScale);
                ctx.fillRect(4 * pixelScale, 9 * pixelScale, 8 * pixelScale, 2 * pixelScale);
                ctx.fillRect(3 * pixelScale, 6 * pixelScale, 2 * pixelScale, 4 * pixelScale);
                ctx.fillRect(11 * pixelScale, 7 * pixelScale, 2 * pixelScale, 3 * pixelScale);
                
                ctx.fillStyle = '#f43f5e';
                ctx.fillRect(4 * pixelScale, 6 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(11 * pixelScale, 5 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(8 * pixelScale, 8 * pixelScale, 1 * pixelScale, 1 * pixelScale);
            }
            else if (type === 'megalopolis_castle') {
                // Modern High-rise skyscraper/castle model
                // Two small outer towers
                ctx.fillStyle = p.armorDark;
                ctx.fillRect(2 * pixelScale, 8 * pixelScale, 3 * pixelScale, 16 * pixelScale);
                ctx.fillRect(11 * pixelScale, 8 * pixelScale, 3 * pixelScale, 16 * pixelScale);

                // Central tall tower
                ctx.fillRect(5 * pixelScale, 2 * pixelScale, 6 * pixelScale, 22 * pixelScale);

                // Highlights
                ctx.fillStyle = p.armor;
                ctx.fillRect(3 * pixelScale, 8 * pixelScale, 1 * pixelScale, 16 * pixelScale);
                ctx.fillRect(12 * pixelScale, 8 * pixelScale, 1 * pixelScale, 16 * pixelScale);
                ctx.fillRect(6 * pixelScale, 2 * pixelScale, 2 * pixelScale, 22 * pixelScale);

                // Outlines
                ctx.strokeStyle = p.outline;
                ctx.lineWidth = pixelScale / 2;
                ctx.strokeRect(2 * pixelScale, 8 * pixelScale, 3 * pixelScale, 16 * pixelScale);
                ctx.strokeRect(11 * pixelScale, 8 * pixelScale, 3 * pixelScale, 16 * pixelScale);
                ctx.strokeRect(5 * pixelScale, 2 * pixelScale, 6 * pixelScale, 22 * pixelScale);

                // Glowing golden windows
                ctx.fillStyle = p.hair;
                ctx.fillRect(3 * pixelScale, 12 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(3 * pixelScale, 17 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                
                ctx.fillRect(6 * pixelScale, 6 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(6 * pixelScale, 11 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(6 * pixelScale, 16 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(9 * pixelScale, 6 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(9 * pixelScale, 11 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(9 * pixelScale, 16 * pixelScale, 1 * pixelScale, 1 * pixelScale);

                ctx.fillRect(12 * pixelScale, 12 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(12 * pixelScale, 17 * pixelScale, 1 * pixelScale, 1 * pixelScale);

                // Spired spire antenna with red dot beacon light at top!
                ctx.fillStyle = p.hair;
                ctx.fillRect(7 * pixelScale, 0 * pixelScale, 2 * pixelScale, 2 * pixelScale);
                ctx.fillStyle = p.cape;
                drawPixel(ctx, 7, 0, p.cape, pixelScale);
            }
            else if (type === 'village_cottage') {
                // Cozy retro thatched house cottage
                // Wood wall base
                ctx.fillStyle = p.boots;
                ctx.fillRect(3 * pixelScale, 8 * pixelScale, 10 * pixelScale, 8 * pixelScale);

                // Triangular brick roof (Orange-red gables)
                ctx.fillStyle = p.shieldLight;
                ctx.beginPath();
                ctx.moveTo(8 * pixelScale, 2 * pixelScale);
                ctx.lineTo(2 * pixelScale, 8 * pixelScale);
                ctx.lineTo(14 * pixelScale, 8 * pixelScale);
                ctx.closePath();
                ctx.fill();

                // Roof details / highlights
                ctx.strokeStyle = p.hair;
                ctx.lineWidth = pixelScale / 2;
                ctx.beginPath();
                ctx.moveTo(8 * pixelScale, 2 * pixelScale);
                ctx.lineTo(2 * pixelScale, 8 * pixelScale);
                ctx.moveTo(8 * pixelScale, 2 * pixelScale);
                ctx.lineTo(14 * pixelScale, 8 * pixelScale);
                ctx.stroke();

                // Outlines around wood house
                ctx.strokeStyle = p.outline;
                ctx.lineWidth = pixelScale / 2;
                ctx.strokeRect(3 * pixelScale, 8 * pixelScale, 10 * pixelScale, 8 * pixelScale);

                // Front door (black center)
                ctx.fillStyle = p.outline;
                ctx.fillRect(7 * pixelScale, 11 * pixelScale, 2 * pixelScale, 5 * pixelScale);

                // Cozy glowing window
                ctx.fillStyle = '#67e8f9';
                ctx.fillRect(4 * pixelScale, 10 * pixelScale, 2 * pixelScale, 2 * pixelScale);
                ctx.fillRect(10 * pixelScale, 10 * pixelScale, 2 * pixelScale, 2 * pixelScale);
                
                // Chimney
                ctx.fillStyle = p.rock;
                ctx.fillRect(11 * pixelScale, 4 * pixelScale, 2 * pixelScale, 4 * pixelScale);
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(9 * pixelScale, 2 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                ctx.fillRect(10 * pixelScale, 1 * pixelScale, 1 * pixelScale, 1 * pixelScale);
            }

            return canvas;
        },

        /**
         * Pre-builds the 12 dynamic movement direction sprites of the Hero and caches them.
         */
        createHeroCanvas(direction, state, pixelScale = 2) {
            const canvas = document.createElement('canvas');
            canvas.width = 16 * pixelScale;
            canvas.height = 16 * pixelScale;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            const p = PALETTE;

            // Simple bobbing index offset step
            const bob = (state !== 'stand') ? 1 : 0;
            const headY = 2 + bob;
            const bodyY = 8 + bob;

            let template = Array(16).fill("................");
            const localPalette = {
                '.': 'transparent',
                'k': p.outline,
                'w': p.white,
                's': p.skin,
                'p': p.skinShadow,
                'y': p.hair,
                'h': p.hairShadow,
                'a': p.armor,
                'd': p.armorDark,
                'c': p.cape,
                'g': p.capeDark,
                'o': p.boots,
                'b': p.shield,
                'l': p.shieldLight,
                'm': p.sword,
                'r': p.swordHilt
            };

            if (direction === 'down') {
                // Cape backdrop silhouette
                template[7+bob] = "..cccccccccc....";
                template[8+bob] = "..cgggaaaagga...";
                template[9+bob] = "..cggdaaaaddc...";
                template[10+bob]= "..cgddaaaaddc...";
                template[11+bob]= "..cdddaaaaddc...";
                template[12+bob]= "..cdddaaaaddc...";
                template[13+bob]= "..cdd......dc...";

                // Spiky Hair
                template[headY-1] = "....yyyyyy......";
                template[headY]   = "...yssssssy.....";
                template[headY+1] = "..yssssssssy....";
                
                // Red headband/helmet
                template[headY+1] = "..ykkkkkkkky....";
                template[headY+2] = "..ykwsswwskky...";
                template[headY+3] = "...yssssssy.....";
                template[headY+4] = "....psssssp.....";

                // Blue armor body
                template[bodyY]   = "...kaaaaeak.....";
                template[bodyY+1] = "..kkaaaaaeakk...";
                template[bodyY+2] = "..kaaaaaaaeak...";
                template[bodyY+3] = "...kaaaaeak.....";

                // Shield on Left (facing us -> right coordinates)
                template[bodyY-1] = template[bodyY-1].replace(/^(.{10}).{4}/, "$1kllk");
                template[bodyY]   = template[bodyY].replace(/^(.{10}).{5}/, "$1kllbk");
                template[bodyY+1] = template[bodyY+1].replace(/^(.{10}).{5}/, "$1kbbbk");
                template[bodyY+2] = template[bodyY+2].replace(/^(.{11}).{4}/, "$1kbbk");

                // Steel Sword on Right (left coordinates)
                template[bodyY]   = template[bodyY].replace(/^.{4}/, "kmkk");
                template[bodyY+1] = template[bodyY+1].replace(/^.{4}/, "kmkk");
                template[bodyY+2] = template[bodyY+2].replace(/^.{4}/, "krkk");

                // Legs walking configs
                if (state === 'stand') {
                    template[14] = "....koo..ook....";
                    template[15] = "....kk...kk.....";
                } else if (state === 'walk1') {
                    template[14] = "....koo..k......";
                    template[15] = "....kk..koo.....";
                } else {
                    template[14] = "......k..ook....";
                    template[15] = "....koo...kk....";
                }
            }
            else if (direction === 'up') {
                // Back of Hero: large red cape, back hair spikes
                template[headY-1] = "....yyyyyy......";
                template[headY]   = "...yhhhhhhy.....";
                template[headY+1] = "..yhhhhhhhhy....";
                template[headY+2] = "..yhhhhhhhhy....";
                template[headY+3] = "...yhhhhhhy.....";
                template[headY+4] = "....hhhhhh......";

                template[bodyY]   = "...kcccccck.....";
                template[bodyY+1] = "..kcccccccck....";
                template[bodyY+2] = "..kcccccccck....";
                template[bodyY+3] = ".kcccccccccck...";
                template[bodyY+4] = ".kcccccccccck...";
                template[bodyY+5] = ".kcc..cc..cck...";

                if (state === 'stand') {
                    template[14] = "....koo..ook....";
                    template[15] = "....kk...kk.....";
                } else if (state === 'walk1') {
                    template[14] = "....koo..k......";
                    template[15] = "....kk..koo.....";
                } else {
                    template[14] = "......k..ook....";
                    template[15] = "....koo...kk....";
                }
            }
            else if (direction === 'left') {
                // Profile facing Left
                template[headY-1] = ".....yyyyy......";
                template[headY]   = "....ysssssy.....";
                template[headY+1] = "...ykkkkksy.....";
                template[headY+2] = "...ykwskksy.....";
                template[headY+3] = "....psssss......";
                template[headY+4] = ".....ppss.......";

                template[bodyY]   = "....kaaaackk....";
                template[bodyY+1] = "...kaaaaaccck...";
                template[bodyY+2] = "...kaaaaaccck...";
                template[bodyY+3] = "....kaaaaccck...";
                template[bodyY+4] = ".....kaaacck....";

                // Sword forward (Left)
                template[bodyY+1] = template[bodyY+1].replace(/^.{4}/, "kmmk");
                template[bodyY+2] = template[bodyY+2].replace(/^.{5}/, "krkkk");

                // Shield back (Right)
                template[bodyY+1] = template[bodyY+1].replace(/.{4}$/, "kbbk");

                if (state === 'stand') {
                    template[14] = ".....koo.ook....";
                    template[15] = ".....kk..kk.....";
                } else if (state === 'walk1') {
                    template[14] = ".....koo.k......";
                    template[15] = ".....kk.koo.....";
                } else {
                    template[14] = ".......k.ook....";
                    template[15] = ".....koo.kk.....";
                }
            }
            else if (direction === 'right') {
                // Profile facing Right
                template[headY-1] = "......yyyyy.....";
                template[headY]   = ".....ysssssy....";
                template[headY+1] = ".....yskkkkky...";
                template[headY+2] = ".....yskkwky....";
                template[headY+3] = "......sssssp....";
                template[headY+4] = ".......sspp.....";

                template[bodyY]   = "....kkcaaaak....";
                template[bodyY+1] = "...kcccaaaaak...";
                template[bodyY+2] = "...kcccaaaaak...";
                template[bodyY+3] = "...kcccaaaak....";
                template[bodyY+4] = "....kccaaak.....";

                // Sword forward (Right)
                template[bodyY+1] = template[bodyY+1].replace(/.{4}$/, "kmmk");
                template[bodyY+2] = template[bodyY+2].replace(/.{5}$/, "kkkrk");

                // Shield back (Left)
                template[bodyY+1] = template[bodyY+1].replace(/^.{4}/, "kbbk");

                if (state === 'stand') {
                    template[14] = "....koo.ook.....";
                    template[15] = "....kk..kk......";
                } else if (state === 'walk1') {
                    template[14] = "....koo.k.......";
                    template[15] = "....kk.koo......";
                } else {
                    template[14] = "......k.ook.....";
                    template[15] = "....koo.kk......";
                }
            }

            // Draw current layout template
            for (let y = 0; y < 16; y++) {
                const row = template[y];
                for (let x = 0; x < 16; x++) {
                    const char = row[x];
                    let color = localPalette[char] || 'transparent';

                    // Subtle specular color edits for dynamic lighting texture looks
                    if (char === 'a') {
                        if (x % 3 === 0 && y % 2 === 0) color = '#60a5fa'; // steel shine
                    }
                    if (char === 'c') {
                        if ((x + y) % 4 === 0) color = '#f87171'; // red cloak highlights
                    }

                    if (color !== 'transparent') {
                        drawPixel(ctx, x, y, color, pixelScale);
                    }
                }
            }

            return canvas;
        },



        /**
         * Preloads the 12 core hero canvases and generic billboards into the cache pool.
         */
        preloadAll2DAssets() {
            const directions = ['down', 'up', 'left', 'right'];
            const states = ['stand', 'walk1', 'walk2'];
            
            // Preload Hero states
            directions.forEach(dir => {
                states.forEach(state => {
                    const key = `hero_${dir}_${state}`;
                    canvasCache[key] = this.createHeroCanvas(dir, state);
                });
            });

            // Preload Ship states
            directions.forEach(dir => {
                states.forEach(state => {
                    const key = `ship_${dir}_${state}`;
                    canvasCache[key] = this.createShipCanvas(dir, state);
                });
            });

            // Preload static decorations
            const decorations = ['forest_tree', 'snow_tree', 'desert_cactus', 'hill_rock', 'mountain_peak', 'grass_tuft', 'coral_plant', 'megalopolis_castle', 'village_cottage'];
            decorations.forEach(type => {
                canvasCache[type] = this.createBillboardCanvas(type);
            });
        },

        /**
         * Compiles a standard HTML Canvas for a 4-direction procedural sailing JRPG caravel ship!
         */
        createShipCanvas(direction, state, pixelScale = 2) {
            const canvas = document.createElement('canvas');
            canvas.width = 16 * pixelScale;
            canvas.height = 16 * pixelScale;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            const p = PALETTE;
            // Frame wave bob indices: 0 (stand), 1 (walk1), 2 (walk2)
            const frameIdx = (state === 'stand') ? 0 : (state === 'walk1') ? 1 : 2;

            // Soft generic wave splashes Y height displacement
            const bobY = (frameIdx !== 0) ? 1 : 0;

            // Common ship colors
            const woodDark = '#7c2d12';
            const woodLight = '#a16207';
            const waterSpl = '#67e8f9';
            const waterFoam = '#e2e8f0';
            const crestBlue = '#3b82f6';

            // Draw Outline function
            const drawOutline = (pathPoints) => {
                ctx.strokeStyle = p.outline;
                ctx.lineWidth = pixelScale / 1.5;
                ctx.beginPath();
                ctx.moveTo(pathPoints[0][0] * pixelScale, pathPoints[0][1] * pixelScale);
                for (let i = 1; i < pathPoints.length; i++) {
                    ctx.lineTo(pathPoints[i][0] * pixelScale, pathPoints[i][1] * pixelScale);
                }
                ctx.stroke();
            };

            if (direction === 'down') {
                // Front Facing Ship
                // 1. Draw central mast
                ctx.fillStyle = woodLight;
                ctx.fillRect(7.5 * pixelScale, (1 + bobY) * pixelScale, 1 * pixelScale, 10 * pixelScale);

                // 2. Main symmetrical white sail
                ctx.fillStyle = p.white;
                ctx.fillRect(4 * pixelScale, (3 + bobY) * pixelScale, 8 * pixelScale, 6 * pixelScale);
                
                // Draw a nice blue cross crest inside sail
                ctx.fillStyle = crestBlue;
                ctx.fillRect(7 * pixelScale, (3 + bobY) * pixelScale, 2 * pixelScale, 6 * pixelScale);
                ctx.fillRect(4 * pixelScale, (5 + bobY) * pixelScale, 8 * pixelScale, 2 * pixelScale);

                // Sail borders
                ctx.strokeStyle = p.outline;
                ctx.lineWidth = pixelScale / 2;
                ctx.strokeRect(4 * pixelScale, (3 + bobY) * pixelScale, 8 * pixelScale, 6 * pixelScale);

                // 3. Wooden hull at bottom
                ctx.fillStyle = woodDark;
                ctx.beginPath();
                ctx.moveTo(3 * pixelScale, (9 + bobY) * pixelScale);
                ctx.lineTo(13 * pixelScale, (9 + bobY) * pixelScale);
                ctx.lineTo(11 * pixelScale, (14 + bobY) * pixelScale);
                ctx.lineTo(5 * pixelScale, (14 + bobY) * pixelScale);
                ctx.closePath();
                ctx.fill();

                // Draw hull outline
                drawOutline([[3, 9+bobY], [13, 9+bobY], [11, 14+bobY], [5, 14+bobY], [3, 9+bobY]]);

                // 4. Wave splash animations at the bottom
                if (frameIdx === 1) {
                    ctx.fillStyle = waterSpl;
                    ctx.fillRect(2 * pixelScale, 13 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                    ctx.fillRect(12 * pixelScale, 13 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                } else if (frameIdx === 2) {
                    ctx.fillStyle = waterSpl;
                    ctx.fillRect(1 * pixelScale, 14 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                    ctx.fillRect(13 * pixelScale, 14 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                }
            }
            else if (direction === 'up') {
                // Back Facing Ship (stern wood cabin, back of white sail)
                // 1. Mast
                ctx.fillStyle = woodLight;
                ctx.fillRect(7.5 * pixelScale, (1 + bobY) * pixelScale, 1 * pixelScale, 9 * pixelScale);

                // 2. Sail backside (pure white with soft grey shadows on right side)
                ctx.fillStyle = p.white;
                ctx.fillRect(4 * pixelScale, (3 + bobY) * pixelScale, 8 * pixelScale, 6 * pixelScale);
                ctx.fillStyle = p.snowShadow;
                ctx.fillRect(9 * pixelScale, (3 + bobY) * pixelScale, 3 * pixelScale, 6 * pixelScale);

                ctx.strokeStyle = p.outline;
                ctx.lineWidth = pixelScale / 2;
                ctx.strokeRect(4 * pixelScale, (3 + bobY) * pixelScale, 8 * pixelScale, 6 * pixelScale);

                // 3. Stern Wooden cabin hull
                ctx.fillStyle = woodDark;
                ctx.fillRect(3 * pixelScale, (9 + bobY) * pixelScale, 10 * pixelScale, 5 * pixelScale);
                // Stern window
                ctx.fillStyle = p.outline;
                ctx.fillRect(7 * pixelScale, (10 + bobY) * pixelScale, 2 * pixelScale, 2 * pixelScale);

                drawOutline([[3, 9+bobY], [13, 9+bobY], [13, 14+bobY], [3, 14+bobY], [3, 9+bobY]]);

                // Wave foam trails behind
                if (frameIdx !== 0) {
                    ctx.fillStyle = waterFoam;
                    ctx.fillRect(5 * pixelScale, 15 * pixelScale, 6 * pixelScale, 1 * pixelScale);
                }
            }
            else if (direction === 'left') {
                // Profile facing Left
                // 1. Hull: Bow curves up left, stern castle rises high right
                ctx.fillStyle = woodDark;
                ctx.beginPath();
                ctx.moveTo(1 * pixelScale, (9 + bobY) * pixelScale); // left top bow
                ctx.lineTo(13 * pixelScale, (8 + bobY) * pixelScale); // right top stern
                ctx.lineTo(12 * pixelScale, (14 + bobY) * pixelScale); // bottom right
                ctx.lineTo(3 * pixelScale, (14 + bobY) * pixelScale); // bottom left
                ctx.closePath();
                ctx.fill();

                drawOutline([[1, 9+bobY], [13, 8+bobY], [12, 14+bobY], [3, 14+bobY], [1, 9+bobY]]);

                // Stern wooden deck rail lines
                ctx.fillStyle = woodLight;
                ctx.fillRect(10 * pixelScale, (9 + bobY) * pixelScale, 3 * pixelScale, 2 * pixelScale);

                // 2. Mast
                ctx.fillStyle = woodLight;
                ctx.fillRect(7 * pixelScale, (1 + bobY) * pixelScale, 1 * pixelScale, 11 * pixelScale);

                // 3. Billowing white sail to the left profile
                ctx.fillStyle = p.white;
                ctx.beginPath();
                ctx.arc(6.5 * pixelScale, (6.5 + bobY) * pixelScale, 3 * pixelScale, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(4 * pixelScale, (3.5 + bobY) * pixelScale, 4 * pixelScale, 6 * pixelScale);

                // Blue crest stripe on profile
                ctx.fillStyle = crestBlue;
                ctx.fillRect(5.5 * pixelScale, (3.5 + bobY) * pixelScale, 2 * pixelScale, 6 * pixelScale);

                // Outline sail path
                ctx.strokeStyle = p.outline;
                ctx.lineWidth = pixelScale / 2;
                ctx.strokeRect(4 * pixelScale, (3.5 + bobY) * pixelScale, 4 * pixelScale, 6 * pixelScale);

                // Splash foam trailing behind to the right
                if (frameIdx !== 0) {
                    ctx.fillStyle = waterSpl;
                    ctx.fillRect(13 * pixelScale, 13 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                }
            }
            else if (direction === 'right') {
                // Profile facing Right (Mirrored)
                ctx.fillStyle = woodDark;
                ctx.beginPath();
                ctx.moveTo(15 * pixelScale, (9 + bobY) * pixelScale); // right top bow
                ctx.lineTo(3 * pixelScale, (8 + bobY) * pixelScale); // left top stern
                ctx.lineTo(4 * pixelScale, (14 + bobY) * pixelScale); // bottom left
                ctx.lineTo(13 * pixelScale, (14 + bobY) * pixelScale); // bottom right
                ctx.closePath();
                ctx.fill();

                drawOutline([[15, 9+bobY], [3, 8+bobY], [4, 14+bobY], [13, 14+bobY], [15, 9+bobY]]);

                ctx.fillStyle = woodLight;
                ctx.fillRect(3 * pixelScale, (9 + bobY) * pixelScale, 3 * pixelScale, 2 * pixelScale);

                // Mast
                ctx.fillStyle = woodLight;
                ctx.fillRect(8 * pixelScale, (1 + bobY) * pixelScale, 1 * pixelScale, 11 * pixelScale);

                // Billowing sail right
                ctx.fillStyle = p.white;
                ctx.beginPath();
                ctx.arc(9.5 * pixelScale, (6.5 + bobY) * pixelScale, 3 * pixelScale, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(8 * pixelScale, (3.5 + bobY) * pixelScale, 4 * pixelScale, 6 * pixelScale);

                ctx.fillStyle = crestBlue;
                ctx.fillRect(8.5 * pixelScale, (3.5 + bobY) * pixelScale, 2 * pixelScale, 6 * pixelScale);

                ctx.strokeStyle = p.outline;
                ctx.lineWidth = pixelScale / 2;
                ctx.strokeRect(8 * pixelScale, (3.5 + bobY) * pixelScale, 4 * pixelScale, 6 * pixelScale);

                // Splash foam left
                if (frameIdx !== 0) {
                    ctx.fillStyle = waterSpl;
                    ctx.fillRect(1 * pixelScale, 13 * pixelScale, 2 * pixelScale, 1 * pixelScale);
                }
            }

            return canvas;
        },

        /**
         * Retrieves the target pre-rendered static decoration canvas element.
         */
        getDecorationCanvas(type) {
            if (!canvasCache[type]) {
                canvasCache[type] = this.createBillboardCanvas(type);
            }
            return canvasCache[type];
        },

        /**
         * Retrieves the target pre-rendered active Ship frame canvas element.
         */
        getShipCanvas(direction, state) {
            const key = `ship_${direction}_${state}`;
            if (!canvasCache[key]) {
                canvasCache[key] = this.createShipCanvas(direction, state);
            }
            return canvasCache[key];
        },

        /**
         * Retrieves the target pre-rendered active Hero/Ship frame canvas element.
         */
        getHeroCanvas(direction, state, travelMode = 'walk') {
            if (travelMode === 'sail') {
                return this.getShipCanvas(direction, state);
            }
            const key = `hero_${direction}_${state}`;
            if (!canvasCache[key]) {
                canvasCache[key] = this.createHeroCanvas(direction, state);
            }
            return canvasCache[key];
        }
    };
})();

// Export for global browser context
window.Assets = Assets;
