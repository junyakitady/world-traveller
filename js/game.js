/**
 * Retro Earth Explorer - 2D Grid Game Engine
 * Implements a premium, high-performance 2D Y-sorted tilemap renderer like modern 2D RPGs.
 * Direct canvas drawing with crisp nearest-neighbor scaling, topo edge drop shadows,
 * real-world unit-circle collisions, seamless East-West map warping, day/night clock,
 * screen-overlay dark night filters with radial hero lantern rings, and weather particles.
 */

const GameEngine = (() => {
    // 1. Core Grid & Layout Constants
    const TILE_SIZE = 48; // display pixels per tile cell
    const W = 720; // global width in grid cells (720x360 high detail Earth)
    const H = 360; // global height in grid cells
    const HALF_W = 360;
    const VIEW_PADDING = 3; // Extra cells buffer rendered offscreen

    // 2. Systems State Cache
    let canvas, ctx;
    let noiseGen;

    // Physical datasets grids
    const elevationGrid = new Float32Array(W * H);
    const biomesGrid = Array(W).fill(null).map(() => Array(H).fill('plains'));
    const heightsCache = Array(W).fill(null).map(() => new Float32Array(H));
    const satelliteColorsGrid = Array(W).fill(null).map(() => Array(H).fill(null));

    // Dynamic Tile Templates Canvas caches for high speed drawing
    const tileCanvasCache = {};

    // Global world cities database (retrieved from cities_db.js)
    const CITIES_DATA = window.CITIES_DATA || [];

    const citiesGridLookup = {};
    let borderFeatures = [];

    // Hero Entity details
    const player = {
        gridX: 639.3834, // continuous grid coords (start at Tokyo for 720x360!)
        gridY: 108.6210,
        direction: 'down',
        state: 'stand',
        moveSpeed: 4.8, // grid cells / sec speed
        runSpeed: 8.2,  // dash cells / sec speed
        travelMode: 'walk', // 'walk' (walking on foot) or 'sail' (sailing ship on water!)
        isMoving: false,
        lastStepX: 639.3834,
        lastStepY: 108.6210,
        stepAccumulator: 0,
        animFrame: 0,
        animTimer: 0
    };

    // Camera follow coordinates in pixels
    let camX = player.gridX * TILE_SIZE;
    let camY = player.gridY * TILE_SIZE;

    // Input tracker state
    const keys = { w: false, a: false, s: false, d: false, Shift: false };
    let isAutoWalking = false;
    let isAutoCameraFollow = true;

    // Environment and weather cycles
    let timeOfDay = 12.0; // noon start
    const TIME_SPEED = 0.18; // clock speed index increment/sec
    let waveFrame = 0;
    let waveTimer = 0;

    const weather = {
        snowOpacity: 0.0,
        leavesOpacity: 0.0,
        sandOpacity: 0.0,
        targetSnow: 0.0,
        targetLeaves: 0.0,
        targetSand: 0.0,
        particles: []
    };

    // Preset Teleport points (Customized 9 Global Cities Presets)
    const LANDMARKS = {
        tokyo: { name: "東京 (日本)", coords: [139.6917, 35.6895], isMegalopolis: true, desc: "日本の首都。無数の高層ビルと光がひしめく巨大なメガロポリス。" },
        london: { name: "ロンドン (英国)", coords: [-0.1278, 51.5074], isMegalopolis: true, desc: "イギリスの首都。テムズ川沿いに歴史的な古城と最新の高層ビルが並ぶ街。" },
        singapore: { name: "シンガポール", coords: [103.8431, 1.3067], isMegalopolis: false, desc: "清潔さと熱帯林が融合する最先端のガーデンシティ国家。" },
        dubai: { name: "ドバイ (UAE)", coords: [55.2708, 25.2048], isMegalopolis: false, desc: "ペルシャ湾にそびえ立つ世界一の超高層タワーと砂漠のオアシス都市。" },
        sydney: { name: "シドニー (豪州)", coords: [151.2093, -33.8688], isMegalopolis: false, desc: "白いオペラハウスと青い太平洋に囲まれた美しい豪州の港湾都市。" },
        hawaii: { name: "ハワイ (米国)", coords: [-157.8583, 21.3069], isMegalopolis: false, desc: "ヤシの木が揺れる美しいワイキキビーチと火山がそびえる太平洋の楽園。" },
        san_francisco: { name: "サンフランシスコ (米国)", coords: [-122.4194, 37.7749], isMegalopolis: false, desc: "霧に包まれる赤いゴールデンゲートブリッジと坂の多い美しき丘陵都市。" },
        new_york: { name: "ニューヨーク (米国)", coords: [-74.0060, 40.7128], isMegalopolis: true, desc: "マンハッタンの摩天楼がそびえ立つ、世界の文化と金融の超巨大中心地。" },
        dallas: { name: "ダラス (米国)", coords: [-96.7970, 32.7767], isMegalopolis: false, desc: "テキサス平原の広大な南部大都市。摩天楼とカウボーイ文化の融合地。" }
    };

    const BIOME_DETAILS = {
        deepSea: { name: "深い海 (Deep Sea)", desc: "水深数千メートルの漆黒の海域。勇者はこれ以上進むことはできません。" },
        shallowSea: { name: "浅い海 (Shallow Sea)", desc: "陽の光が届く美しい沿岸海域。打ち寄せる波が穏やかに光を反射しています。" },
        coralReef: { name: "珊瑚礁の海 (Coral Reef Sea)", desc: "色鮮やかな熱帯のサンゴ礁が広がる浅海域。ターコイズブルーの海面が輝きます。" },
        plains: { name: "平地草原 (Grassland Plains)", desc: "青々と茂る穏やかな緑の平地。冒険の旅に最も適した過ごしやすい草原です。" },
        forest: { name: "深い森 (Forest)", desc: "豊かな木々が生い茂る森林地帯。風がそよぐと葉が擦れ合う音が静かに響きます。" },
        walkableHills: { name: "歩ける山地 (Walkable Hills)", desc: "緩やかな起伏が続く茶色い丘陵地帯。足場が少し悪く、移動速度が落ちます。" },
        impassableMountains: { name: "歩けない山脈 (Alpine Range)", desc: "雲を突き抜ける険しい高山山脈。頂には万年雪を冠し、勇者の進入を拒みます。" },
        snowfield: { name: "静寂の雪原 (Snowfield)", desc: "粉雪が舞う極寒の銀世界。凍てつく風が吹き荒れ、足元が滑るため注意が必要です。" },
        desert: { name: "黄金の砂漠 (Desert)", desc: "熱風が吹き抜ける乾燥した砂の大地。サボテンが自生し、歩くたびに砂塵が舞い上がります。" }
    };

    // Offscreen canvas for Day/Night lighting mask filters
    let lightMaskCanvas, lightMaskCtx;

    // Start setup loop on load
    window.addEventListener('DOMContentLoaded', () => {
        setup2DEngine();
        setupInput();
        setupTelemetryHUD();
        loadHeightmapAndStart();
    });

    /**
     * Initializes core 2D canvas components.
     */
    function setup2DEngine() {
        const container = document.getElementById('viewport-container');
        container.innerHTML = ''; // wipe any previous WebGL canvases

        canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        ctx = canvas.getContext('2d');
        
        // Setup offscreen lighting canvas
        lightMaskCanvas = document.createElement('canvas');
        lightMaskCtx = lightMaskCanvas.getContext('2d');

        // Handle resizing
        const resize = () => {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            lightMaskCanvas.width = canvas.width;
            lightMaskCanvas.height = canvas.height;
            
            // Set crisp pixel properties after resize resets context!
            ctx.imageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
        };
        window.addEventListener('resize', resize);
        resize();

        noiseGen = new ValueNoise2D(8888);
        initializeParticles();
    }

    /**
     * Spawns core weather particles base positions.
     */
    function initializeParticles() {
        weather.particles = [];
        for (let i = 0; i < 150; i++) {
            weather.particles.push({
                x: Math.random(),
                y: Math.random(),
                speedX: 0.1 + Math.random() * 0.2,
                speedY: 0.4 + Math.random() * 0.4,
                size: 1 + Math.random() * 3,
                angle: Math.random() * Math.PI
            });
        }
    }

    /**
     * Set up keyboard and active control hooks.
     */
    function setupInput() {
        const onKey = (val) => (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w' || e.key === 'ArrowUp') keys.w = val;
            if (k === 's' || e.key === 'ArrowDown') keys.s = val;
            if (k === 'a' || e.key === 'ArrowLeft') keys.a = val;
            if (k === 'd' || e.key === 'ArrowRight') keys.d = val;
            if (e.key === 'Shift') keys.Shift = val;

            if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) {
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', onKey(true));
        window.addEventListener('keyup', onKey(false));

        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'p') {
                isAutoWalking = !isAutoWalking;
                document.getElementById('checkbox-autowalk').checked = isAutoWalking;
                showTickerNotification(isAutoWalking ? "オートウォークを開始しました" : "オートウォークを解除しました");
            }
            if (e.key.toLowerCase() === 'c') {
                isAutoCameraFollow = !isAutoCameraFollow;
                document.getElementById('checkbox-camerafollow').checked = isAutoCameraFollow;
                showTickerNotification(isAutoCameraFollow ? "カメラ追尾をロックしました" : "フリーカメラモードになりました");
            }
        });

        // HUD switches linkage
        document.getElementById('checkbox-autowalk').addEventListener('change', (e) => {
            isAutoWalking = e.target.checked;
        });
        document.getElementById('checkbox-camerafollow').addEventListener('change', (e) => {
            isAutoCameraFollow = e.target.checked;
        });
        document.getElementById('checkbox-shadows').addEventListener('change', (e) => {
            showTickerNotification(e.target.checked ? "地形ドロップシャドウを有効化" : "影を非表示にしました");
        });
        document.getElementById('checkbox-crt').addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('crt-active');
            } else {
                document.body.classList.remove('crt-active');
            }
        });
        document.getElementById('checkbox-weather').addEventListener('change', (e) => {
            showTickerNotification(e.target.checked ? "環境パーティクルを有効化" : "パーティクルを停止しました");
        });

        // BGM controls button link
        const btnBgm = document.getElementById('btn-toggle-bgm');
        btnBgm.addEventListener('click', () => {
            const isPlaying = RetroAudio.toggleBgm();
            btnBgm.textContent = isPlaying ? "🎵 音楽停止 (Mute)" : "🎵 音楽再生 (Play Theme)";
            btnBgm.style.background = isPlaying ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)";
        });

        document.getElementById('slider-vol-master').addEventListener('input', (e) => {
            RetroAudio.setMasterVolume(parseFloat(e.target.value));
        });
        document.getElementById('slider-vol-bgm').addEventListener('input', (e) => {
            RetroAudio.setMusicVolume(parseFloat(e.target.value));
        });
        document.getElementById('slider-vol-sfx').addEventListener('input', (e) => {
            RetroAudio.setSfxVolume(parseFloat(e.target.value));
        });

        // Minimap mouse warp triggers
        const mCanvas = document.getElementById('minimap-canvas');
        mCanvas.addEventListener('click', (e) => {
            const rect = mCanvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const u = clickX / rect.width;
            const v = clickY / rect.height;

            const targetLon = -180 + 360 * u;
            const targetLat = 90 - 180 * v;

            teleportPlayerToCoords(targetLon, targetLat, "指定転移座標");
        });

        // Mouse canvas drag camera panning controls in Free mode!
        let isDragging = false;
        let startDragX = 0, startDragY = 0;
        let startCamX = 0, startCamY = 0;

        canvas.addEventListener('mousedown', (e) => {
            if (!isAutoCameraFollow) {
                isDragging = true;
                startDragX = e.clientX;
                startDragY = e.clientY;
                startCamX = camX;
                startCamY = camY;
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (isDragging && !isAutoCameraFollow) {
                const dx = e.clientX - startDragX;
                const dy = e.clientY - startDragY;
                camX = startCamX - dx;
                camY = startCamY - dy;
            }
        });
        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        canvas.addEventListener('dblclick', () => {
            isAutoCameraFollow = true;
            document.getElementById('checkbox-camerafollow').checked = true;
            showTickerNotification("カメラ追尾をロックしました");
        });
    }

    /**
     * Builds standard list of sidebar portal elements.
     */
    function setupTelemetryHUD() {
        // Primary Tokyo quick return button listener!
        const btnTokyo = document.getElementById('btn-warp-tokyo');
        if (btnTokyo) {
            btnTokyo.addEventListener('click', () => {
                teleportPlayerToCoords(139.6917, 35.6895, "東京 (日本)");
            });
        }

        // Search input key events hook listener!
        const searchInput = document.getElementById('city-search-input');
        if (searchInput) {
            // Trigger filter immediately as they type!
            searchInput.addEventListener('input', (e) => {
                filterTelemetryHUD(e.target.value);
            });
            // Stop key events bubble up to the game keyboard controllers (WASD) so typing doesn't move the player!
            searchInput.addEventListener('keydown', (e) => {
                e.stopPropagation();
            });
            searchInput.addEventListener('keyup', (e) => {
                e.stopPropagation();
            });
        }

        // Trigger initial Featured default list render!
        filterTelemetryHUD("");
    }

    /**
     * Filters the world cities/capitals database by name/description and displays matching teleport options in the grid.
     */
    function filterTelemetryHUD(query = "") {
        const grid = document.getElementById('teleport-landmarks-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const q = query.trim().toLowerCase();

        // If the query is empty, show our featured standard 9 preset landmarks!
        if (q === "") {
            Object.keys(LANDMARKS).forEach(key => {
                const item = LANDMARKS[key];
                const btn = document.createElement('button');
                btn.className = 'landmark-btn';
                // Color Megalopolises gold, others standard white/silver!
                const isMegalopolis = item.isMegalopolis;
                
                btn.innerHTML = `
                    <span class="landmark-title" style="color: ${isMegalopolis ? '#fbbf24' : '#fff'}; font-weight: ${isMegalopolis ? '700' : '500'};">${escapeHTML(item.name)}</span>
                    <span class="landmark-desc">${item.coords[0].toFixed(2)}°, ${item.coords[1].toFixed(2)}°</span>
                `;
                btn.addEventListener('click', () => {
                    teleportPlayerToCoords(item.coords[0], item.coords[1], item.name);
                });
                grid.appendChild(btn);
            });
            return;
        }

        // Scan full 210-city database for matching query text!
        let matchesCount = 0;
        for (let i = 0; i < CITIES_DATA.length; i++) {
            const city = CITIES_DATA[i];
            const nameMatch = city.name.toLowerCase().includes(q);
            const descMatch = city.desc.toLowerCase().includes(q);
            // Search tag queries support: "都市", "首都", "村"!
            const typeMatch = (q === '都市' && city.type === 'megalopolis') || 
                              (q === '首都' && city.type === 'village') || 
                              (q === '村' && city.type === 'village') ||
                              city.type.toLowerCase().includes(q);

            if (nameMatch || descMatch || typeMatch) {
                const btn = document.createElement('button');
                btn.className = 'landmark-btn';
                const isMegalopolis = (city.type === 'megalopolis');

                btn.innerHTML = `
                    <span class="landmark-title" style="color: ${isMegalopolis ? '#fbbf24' : '#cbd5e1'}; font-weight: ${isMegalopolis ? '700' : '500'};">${escapeHTML(city.name)}</span>
                    <span class="landmark-desc" style="font-size: 8px; color: ${isMegalopolis ? '#fef08a' : '#94a3b8'};">${isMegalopolis ? '🏙️ メガロポリス' : '🏡 首都・村'} / ${city.coords[0].toFixed(2)}°, ${city.coords[1].toFixed(2)}°</span>
                `;
                btn.addEventListener('click', () => {
                    teleportPlayerToCoords(city.coords[0], city.coords[1], city.name);
                });
                grid.appendChild(btn);
                matchesCount++;

                if (matchesCount >= 30) break; // limit results size
            }
        }

        if (matchesCount === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.gridColumn = 'span 2';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.padding = '12px';
            emptyMsg.style.fontSize = '10px';
            emptyMsg.style.color = '#64748b';
            emptyMsg.textContent = '合致する都市が見つかりません。';
            grid.appendChild(emptyMsg);
        }
    }

    /**
     * Parses a world boundaries GeoJSON into local precompiled grid coordinates rings.
     */
    function parseGeoJSONBorders(geojson) {
        const borderFeatures = [];
        if (!geojson || !geojson.features) return borderFeatures;

        geojson.features.forEach(feature => {
            const name = feature.properties ? feature.properties.name : "Unknown";
            const geometry = feature.geometry;
            if (!geometry) return;

            const rings = [];
            if (geometry.type === "Polygon") {
                geometry.coordinates.forEach(ring => {
                    rings.push(ring.map(coord => ({
                        x: (coord[0] + 180) / 360 * W,
                        y: (90 - coord[1]) / 180 * H
                    })));
                });
            } else if (geometry.type === "MultiPolygon") {
                geometry.coordinates.forEach(polygon => {
                    polygon.forEach(ring => {
                        rings.push(ring.map(coord => ({
                            x: (coord[0] + 180) / 360 * W,
                            y: (90 - coord[1]) / 180 * H
                        })));
                    });
                });
            }

            borderFeatures.push({ name, rings });
        });
        return borderFeatures;
    }

    /**
     * Loads physical displacement raster heights map, samples grids, pre-renders terrain textures templates.
     */
    function loadHeightmapAndStart() {
        const sub = document.querySelector('.loading-sub');
        sub.textContent = "高度マップ、地表カラー画像及び国境境界をロード中...";

        const heightmapImg = new Image();
        const satelliteImg = new Image();

        let heightmapLoaded = false;
        let satelliteLoaded = false;
        let bordersLoaded = false;

        const onAssetLoaded = () => {
            if (heightmapLoaded && satelliteLoaded && bordersLoaded) {
                processGeographicData(heightmapImg, satelliteImg, sub);
            }
        };

        // Load Borders GeoJSON in parallel
        fetch('assets/world.geojson')
            .then(res => res.json())
            .then(data => {
                borderFeatures = parseGeoJSONBorders(data);
                bordersLoaded = true;
                onAssetLoaded();
            })
            .catch(err => {
                console.error("Failed to load world borders:", err);
                borderFeatures = []; // Fallback to empty borders gracefully
                bordersLoaded = true;
                onAssetLoaded();
            });

        heightmapImg.onload = () => {
            heightmapLoaded = true;
            onAssetLoaded();
        };
        heightmapImg.onerror = () => {
            sub.textContent = "エラー：高度データの取得に失敗しました。再読込してください。";
            sub.style.color = "#ef4444";
        };

        satelliteImg.onload = () => {
            satelliteLoaded = true;
            onAssetLoaded();
        };
        satelliteImg.onerror = () => {
            sub.textContent = "エラー：衛星カラー画像の取得に失敗しました。再読込してください。";
            sub.style.color = "#ef4444";
        };

        // Trigger loading after handlers setup
        heightmapImg.src = 'assets/earth_heightmap.jpg';
        satelliteImg.src = 'assets/earth_satellite.jpg';
    }

    function processGeographicData(hImg, sImg, sub) {
        sub.textContent = "高度データをサンプリング中...";

        const hOffscreen = document.createElement('canvas');
        hOffscreen.width = W; hOffscreen.height = H;
        const hCtx = hOffscreen.getContext('2d');
        hCtx.drawImage(hImg, 0, 0, W, H);
        const hData = hCtx.getImageData(0, 0, W, H).data;

        const sOffscreen = document.createElement('canvas');
        sOffscreen.width = W; sOffscreen.height = H;
        const sCtx = sOffscreen.getContext('2d');
        sCtx.drawImage(sImg, 0, 0, W, H);
        const sData = sCtx.getImageData(0, 0, W, H).data;

        // Extract elevation heights
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const idx = (r * W + c) * 4;
                const hVal = (hData[idx] + hData[idx + 1] + hData[idx + 2]) / 3;
                elevationGrid[r * W + c] = hVal;
            }
        }

        sub.textContent = "衛星カラー分析による地表気候の解析中...";

        // Process biomes and cache heights
        for (let c = 0; c < W; c++) {
            const lon = -180 + 360 * (c / W);
            for (let r = 0; r < H; r++) {
                const lat = 90 - 180 * (r / H);
                
                const idx = (r * W + c) * 4;
                const sr = sData[idx];
                const sg = sData[idx + 1];
                const sb = sData[idx + 2];

                // Cache satellite colors for telemetry HUD debugging!
                satelliteColorsGrid[c][r] = { r: sr, g: sg, b: sb };

                const elev = elevationGrid[r * W + c];
                const biome = classifyBiomeFromRGB(sr, sg, sb, lat, lon, elev);
                biomesGrid[c][r] = biome;

                const WATER_LEVEL = 20;
                if (elev <= WATER_LEVEL) {
                    heightsCache[c][r] = (elev - WATER_LEVEL) * 0.2;
                } else {
                    heightsCache[c][r] = (elev - WATER_LEVEL) * 0.28;
                }
            }
        }

        // Special override to keep the Bab-el-Mandeb Strait open for sailing travel between the Red Sea and Gulf of Aden!
        const straitCells = [
            { c: 446, r: 153 },
            { c: 446, r: 154 },
            { c: 446, r: 155 }
        ];
        straitCells.forEach(cell => {
            biomesGrid[cell.c][cell.r] = 'shallowSea';
            elevationGrid[cell.r * W + cell.c] = 0; // force sea-level water elevation
            heightsCache[cell.c][cell.r] = -4.0; // shallow sea negative height displacement
        });

        // Register and override world cities!
        CITIES_DATA.forEach(city => {
            const c = Math.floor((city.coords[0] + 180) / 360 * W) % W;
            const r = Math.max(0, Math.min(H - 1, Math.floor((90 - city.coords[1]) / 180 * H)));
            
            citiesGridLookup[`${c}_${r}`] = city;
            biomesGrid[c][r] = city.type; // override biome floor to 'megalopolis' or 'village'
        });

        sub.textContent = "2Dピクセルテクスチャと勇者の歩行フレームをコンパイル中...";

        // Pre-compile sprites canvases
        Assets.preloadAll2DAssets();

        // Pre-compile base 9 biomes 16x16 terrain tiles templates
        const biomes = ['deepSea', 'shallowSea', 'coralReef', 'plains', 'forest', 'walkableHills', 'impassableMountains', 'snowfield', 'desert'];
        biomes.forEach(b => {
            for (let f = 0; f < 3; f++) {
                const tCanvas = document.createElement('canvas');
                tCanvas.width = 16; tCanvas.height = 16;
                const tCtx = tCanvas.getContext('2d');
                Assets.drawTerrainTile(tCtx, b, 0, 0, 16, f);
                tileCanvasCache[`tile_${b}_${f}`] = tCanvas;
            }
        });

        sub.textContent = "リアルな地球ミニマップ描画中...";
        buildMinimapStaticImage();

        // Hide overlay loading screen
        document.getElementById('loading-overlay').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading-overlay').style.display = 'none';
        }, 500);

        // Trigger dynamic intervals loop!
        lastTime = performance.now();
        requestAnimationFrame(gameLoopTick);
    }

    /**
     * Retrieve precompiled 16x16 terrain tile canvas segment.
     */
    function getTerrainTileCanvas(biomeType, frame) {
        return tileCanvasCache[`tile_${biomeType}_${frame}`] || tileCanvasCache['tile_plains_0'];
    }

    /**
     * Safe HTML-escape utility to prevent potential injection vectors in template strings.
     */
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, (m) => {
            switch (m) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#039;';
                default: return m;
            }
        });
    }

    /**
     * Evaluates bio classification according to heightmap elevations and local dryness noise.
     */
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    function classifyBiomeFromRGB(r, g, b, lat, lon, elev) {
        const hsl = rgbToHsl(r, g, b);
        const h = hsl.h;
        const s = hsl.s;
        const l = hsl.l;

        const WATER_LEVEL = 20;

        // Water vs Land check (using hybrid elevation map & color thresholds)
        const isWaterColor = (h >= 160 && h <= 260 && l < 65 && s > 15);
        const isDeepWaterColor = (r < 32 && g < 45 && b < 85);

        if (elev <= WATER_LEVEL || isWaterColor || isDeepWaterColor) {
            // Deep Sea
            if (l < 16 || b < 45 || elev <= 8) {
                return 'deepSea';
            }
            // Coral Reef: Warm tropical latitudes, shallow turquoise waters
            if (Math.abs(lat) < 24 && h >= 165 && h <= 195 && l >= 36 && s > 40 && elev > 8) {
                return 'coralReef';
            }
            return 'shallowSea';
        }

        // Land Biomes
        if (elev > 185) {
            return 'impassableMountains';
        }

        // Snowfield: Glacier white colors or cold polar land masses
        const isPolarZone = (lat > 63 || lat < -58);
        const isBrightWhite = (l >= 80 && s < 22);
        const isHighAltSnow = (elev > 145 && l >= 72 && s < 18);

        if (isBrightWhite || isHighAltSnow || (isPolarZone && l >= 55 && s < 25)) {
            return 'snowfield';
        }

        // Rocky mountains (gray/slate low-saturation rock at high altitude)
        if (elev > 140 && s < 14 && l >= 25 && l <= 60) {
            if (elev > 165) return 'impassableMountains';
            return 'walkableHills';
        }

        // Desert check: sandy golden yellow-orange tan colors
        const isDesertColor = (h >= 22 && h <= 58 && l >= 34 && l <= 76 && s >= 10);
        const isSandRGB = (r > b + 40 && g > b + 15 && r > 120);

        if (isDesertColor || isSandRGB) {
            return 'desert';
        }

        // Forest: Deep dark greens
        const isForestColor = (h >= 60 && h <= 160 && l < 36 && s > 15);
        const isForestRGB = (g > r + 12 && g > b + 12 && l < 40);

        if (isForestColor || isForestRGB) {
            return 'forest';
        }

        // Walkable Hills (Arid brown, transitions)
        const isHillColor = (h >= 18 && h <= 42 && l >= 22 && l <= 54 && s < 38);
        if (isHillColor || (elev > 140 && s < 25)) {
            return 'walkableHills';
        }

        // Default open land
        return 'plains';
    }

    /**
     * Builds dynamic static colored raster on the HUD sidebar card.
     */
    function buildMinimapStaticImage() {
        const mCanvas = document.getElementById('minimap-canvas');
        mCanvas.width = W; mCanvas.height = H;
        const mCtx = mCanvas.getContext('2d');

        for (let col = 0; col < W; col++) {
            for (let row = 0; row < H; row++) {
                const biome = biomesGrid[col][row];
                let color = Assets.PALETTE.plains;
                if (biome === 'deepSea') color = Assets.PALETTE.deepSea;
                else if (biome === 'shallowSea') color = Assets.PALETTE.shallowSea;
                else if (biome === 'coralReef') color = '#06b6d4';
                else if (biome === 'forest') color = Assets.PALETTE.forest;
                else if (biome === 'walkableHills') color = '#a16207';
                else if (biome === 'impassableMountains') color = '#475569';
                else if (biome === 'snowfield') color = '#ffffff';
                else if (biome === 'desert') color = '#eab308';

                mCtx.fillStyle = color;
                mCtx.fillRect(col, row, 1, 1);
            }
        }
    }

    /**
     * Returns whether the target coordinate is impassable on foot.
     */
    function isTileBlockedForMode(c, r, mode = 'walk') {
        const biome = biomesGrid[c][r];
        if (mode === 'walk') {
            return (
                biome === 'deepSea' ||
                biome === 'shallowSea' ||
                biome === 'coralReef' ||
                biome === 'impassableMountains'
            );
        } else {
            // Sailing ship mode: blocked by ALL land tiles, AND alpine mountains!
            const isWater = (biome === 'deepSea' || biome === 'shallowSea' || biome === 'coralReef');
            return !isWater || biome === 'impassableMountains';
        }
    }

    /**
     * Resolves continuous movement step inputs in grid space using cell AABB sliding pushes.
     */
    function resolveCollisions(px, py, vx, vy, travelMode = 'walk') {
        let nx = px + vx;
        let ny = py + vy;
        const radius = 0.24; // circle size boundary in grid cells

        const colCenter = Math.round(nx);
        const rowCenter = Math.round(ny);

        let didCollision = false;

        for (let dRow = -1; dRow <= 1; dRow++) {
            const rIdx = Math.max(0, Math.min(H - 1, rowCenter + dRow));
            for (let dCol = -1; dCol <= 1; dCol++) {
                const cIdx = (colCenter + dCol + W) % W;

                if (isTileBlockedForMode(cIdx, rIdx, travelMode)) {
                    // Impassable cell unit boundaries coordinates
                    let boxMinX = cIdx;
                    let boxMaxX = cIdx + 1;
                    const boxMinY = rIdx;
                    const boxMaxY = rIdx + 1;

                    // Seam wrap distance projections
                    if (nx - (cIdx + 0.5) > HALF_W) {
                        boxMinX += W; boxMaxX += W;
                    } else if ((cIdx + 0.5) - nx > HALF_W) {
                        boxMinX -= W; boxMaxX -= W;
                    }

                    const closestX = Math.max(boxMinX, Math.min(nx, boxMaxX));
                    const closestY = Math.max(boxMinY, Math.min(ny, boxMaxY));

                    const dx = nx - closestX;
                    const dy = ny - closestY;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < radius * radius && distSq > 0.0001) {
                        const dist = Math.sqrt(distSq);
                        const overlap = radius - dist;

                        nx += (dx / dist) * overlap;
                        ny += (dy / dist) * overlap;
                        didCollision = true;
                    }
                }
            }
        }

        return { x: nx, y: ny, collision: didCollision };
    }

    /**
     * Warps player position instantly and centers camera.
     */
    function teleportPlayerToCoords(lon, lat, locationName) {
        const col = (lon + 180) / 360 * W;
        const row = (90 - lat) / 180 * H;

        player.gridX = (col % W + W) % W;
        player.gridY = Math.max(0, Math.min(H - 1, row));
        player.lastStepX = player.gridX;
        player.lastStepY = player.gridY;
        player.stepAccumulator = 0;

        // Snaps camera immediately to avoid camera slide back lag!
        camX = player.gridX * TILE_SIZE;
        camY = player.gridY * TILE_SIZE;

        RetroAudio.playTeleportSound();
        showTickerNotification(`瞬間移動：${locationName} へ転移しました`);
    }

    /**
     * Displays scrolling status feedback notifications.
     */
    let statusTimer = 0;
    function showTickerNotification(text) {
        const bar = document.getElementById('hud-notification-ticker');
        bar.textContent = `[ ${text} ]`;
        bar.style.opacity = '1.0';
        
        if (statusTimer) clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
            bar.style.opacity = '0.0';
        }, 2500);
    }

    // 6. Game loop execution ticks
    let lastTime = 0;

    function gameLoopTick(now) {
        requestAnimationFrame(gameLoopTick);

        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        updateMovement(dt);
        updateEnvironment(dt);
        updateHUD();
        render2DMap();
    }

    /**
     * Resolves key inputs, triggers boundary wrapping, distances beep steps.
     */
    function updateMovement(dt) {
        let vx = 0;
        let vy = 0;

        if (isAutoWalking) {
            // Auto walk travels Eastwards steadily!
            vx = 1.0;
        } else {
            if (keys.w) vy -= 1;
            if (keys.s) vy += 1;
            if (keys.a) vx -= 1;
            if (keys.d) vx += 1;
        }

        const isRunning = keys.Shift && !isAutoWalking;
        let currentSpeed = isRunning ? player.runSpeed : player.moveSpeed;
        if (player.travelMode === 'sail') {
            currentSpeed = isRunning ? 10.5 : 6.8; // sailing ship is faster!
        }

        player.isMoving = (vx !== 0 || vy !== 0);

        if (player.isMoving) {
            // Normalize direction vector
            const length = Math.sqrt(vx * vx + vy * vy);
            vx = (vx / length) * currentSpeed * dt;
            vy = (vy / length) * currentSpeed * dt;

            // Determine active orientation
            if (Math.abs(vx) > Math.abs(vy)) {
                player.direction = (vx > 0) ? 'right' : 'left';
            } else {
                player.direction = (vy > 0) ? 'down' : 'up';
            }

            // Check next dynamic travel mode transitions (Adjacent shoreline collision check!)
            let dCol = 0, dRow = 0;
            if (player.direction === 'right') dCol = 1;
            else if (player.direction === 'left') dCol = -1;
            else if (player.direction === 'down') dRow = 1;
            else if (player.direction === 'up') dRow = -1;

            const adjC = (Math.floor(player.gridX) + dCol + W) % W;
            const adjR = Math.max(0, Math.min(H - 1, Math.floor(player.gridY) + dRow));
            const adjBiome = biomesGrid[adjC][adjR];

            // Distance to the boundary between current cell and adjacent cell (deadlock-free floor math!)
            let distToBorder = 999;
            if (dCol !== 0) {
                const borderX = Math.floor(player.gridX) + (dCol === 1 ? 1.0 : 0.0);
                distToBorder = Math.abs(borderX - player.gridX);
            } else if (dRow !== 0) {
                const borderY = Math.floor(player.gridY) + (dRow === 1 ? 1.0 : 0.0);
                distToBorder = Math.abs(borderY - player.gridY);
            }

            let skipCollision = false;

            if (distToBorder <= 0.28) {
                const isWater = (adjBiome === 'deepSea' || adjBiome === 'shallowSea' || adjBiome === 'coralReef');
                const isMountain = (adjBiome === 'impassableMountains');

                if (player.travelMode === 'walk' && isWater) {
                    // Step into water: board the ship and snap to adjacent water cell center!
                    player.travelMode = 'sail';
                    player.gridX = adjC;
                    player.gridY = adjR;
                    player.lastStepX = player.gridX;
                    player.lastStepY = player.gridY;
                    skipCollision = true;
                    RetroAudio.playTeleportSound(); // Boarding sound chime!
                    showTickerNotification("船を召喚し、海へ出港しました！ (Sailing Mode Active)");
                } else if (player.travelMode === 'sail' && !isWater && !isMountain) {
                    // Steer into land: disembark and snap to adjacent land cell center!
                    player.travelMode = 'walk';
                    player.gridX = adjC;
                    player.gridY = adjR;
                    player.lastStepX = player.gridX;
                    player.lastStepY = player.gridY;
                    skipCollision = true;
                    RetroAudio.playBumpSound(); // Landfall step pop!
                    showTickerNotification("上陸しました。徒歩での冒険に戻ります (Walking Mode Active)");
                }
            }

            if (!skipCollision) {
                // Slide collision solver grid mechanics (mode-aware!)
                const result = resolveCollisions(player.gridX, player.gridY, vx, vy, player.travelMode);
                player.gridX = result.x;
                player.gridY = result.y;

                if (result.collision && Math.abs(vx) + Math.abs(vy) > 0.001) {
                    if (Math.random() < 0.06) {
                        RetroAudio.playBumpSound();
                    }
                }
            }

            // East-West endless map looping!
            if (player.gridX >= W) {
                player.gridX -= W; player.lastStepX -= W;
            } else if (player.gridX < 0) {
                player.gridX += W; player.lastStepX += W;
            }

            // Step sound accumulator system (based on grid distances)
            const dx = player.gridX - player.lastStepX;
            const dy = player.gridY - player.lastStepY;
            const walkDist = Math.sqrt(dx * dx + dy * dy);
            player.stepAccumulator += walkDist;

            const stepGoal = isRunning ? 0.85 : 0.65;
            if (player.stepAccumulator >= stepGoal) {
                player.stepAccumulator = 0;
                player.lastStepX = player.gridX;
                player.lastStepY = player.gridY;

                const c = (Math.floor(player.gridX) % W + W) % W;
                const r = Math.max(0, Math.min(H - 1, Math.floor(player.gridY)));
                const currentBiome = biomesGrid[c][r];

                const soundType = (player.travelMode === 'sail') ? 'sail' : currentBiome;
                RetroAudio.playStepSound(soundType);
            }

            // Bob animation stepping frames
            player.animTimer += dt * (isRunning ? 12.0 : 8.0);
            player.state = (Math.floor(player.animTimer) % 2 === 0) ? 'walk1' : 'walk2';
        } else {
            player.state = 'stand';
            player.animTimer = 0;
            player.stepAccumulator = 0;
            player.lastStepX = player.gridX;
            player.lastStepY = player.gridY;
        }

        // Smooth Camera Linear follow tracking behind the player coordinate
        if (isAutoCameraFollow) {
            const targetCamX = player.gridX * TILE_SIZE;
            const targetCamY = player.gridY * TILE_SIZE;

            // Seam-aware camera jump wrapping to prevent massive map scrolls slides!
            const worldPixelWidth = W * TILE_SIZE;
            if (targetCamX - camX > worldPixelWidth / 2) {
                camX += worldPixelWidth;
            } else if (camX - targetCamX > worldPixelWidth / 2) {
                camX -= worldPixelWidth;
            }

            const lerpSpeed = 0.08;
            camX += (targetCamX - camX) * lerpSpeed;
            camY += (targetCamY - camY) * lerpSpeed;
        }
    }

    /**
     * Environmental time ticks, animated wave offsets, weather volumes, particles loops.
     */
    function updateEnvironment(dt) {
        // 1. clock increments
        timeOfDay = (timeOfDay + dt * TIME_SPEED) % 24.0;

        // 2. Wave cycles updates
        waveTimer += dt;
        if (waveTimer >= 0.45) {
            waveTimer = 0;
            waveFrame = (waveFrame + 1) % 3;
        }

        // 3. Weather intensities mapping
        const col = (Math.floor(player.gridX) % W + W) % W;
        const row = Math.max(0, Math.min(H - 1, Math.floor(player.gridY)));
        const currentBiome = biomesGrid[col][row];

        weather.targetSnow = (currentBiome === 'snowfield') ? 1.0 : 0.0;
        weather.targetSand = (currentBiome === 'desert') ? 1.0 : 0.0;
        weather.targetLeaves = (currentBiome === 'forest' || currentBiome === 'plains') ? 1.0 : 0.0;

        const lerpSpeed = 0.05;
        weather.snowOpacity += (weather.targetSnow - weather.snowOpacity) * lerpSpeed;
        weather.sandOpacity += (weather.targetSand - weather.sandOpacity) * lerpSpeed;
        weather.leavesOpacity += (weather.targetLeaves - weather.leavesOpacity) * lerpSpeed;

        // Animate individual 2D screen spaces particles float
        const activeWeatherState = document.getElementById('checkbox-weather').checked;
        if (activeWeatherState) {
            weather.particles.forEach(p => {
                // Snow falls down-left slowly
                if (weather.snowOpacity > 0.02) {
                    p.y += p.speedY * dt * 0.15;
                    p.x += Math.sin(p.angle) * dt * 0.04;
                    p.angle += dt * 2.0;
                }
                // Leaves drift down-right wavy
                if (weather.leavesOpacity > 0.02) {
                    p.y += p.speedY * dt * 0.1;
                    p.x += p.speedX * dt * 0.18;
                }
                // Sand sweeps fast horizontally leftwards!
                if (weather.sandOpacity > 0.02) {
                    p.x -= p.speedX * dt * 0.75;
                    p.y += (Math.sin(p.angle) * 0.08) * dt;
                }

                // Wrap around edges boundaries of screen (range 0 to 1)
                if (p.y > 1.0) { p.y = 0.0; p.x = Math.random(); }
                if (p.x > 1.0) { p.x = 0.0; p.y = Math.random(); }
                if (p.x < 0.0) { p.x = 1.0; p.y = Math.random(); }
            });
        }
    }

    /**
     * Telemetry numbers refresh, mini clock ticks, coordinates minimap blinker anchors.
     */
    function updateHUD() {
        const colIdx = (Math.floor(player.gridX) % W + W) % W;
        const rowIdx = Math.max(0, Math.min(H - 1, Math.floor(player.gridY)));

        const lon = -180 + 360 * (colIdx / W);
        const lat = 90 - 180 * (rowIdx / H);

        const elevationRaw = elevationGrid[rowIdx * W + colIdx];
        const elevationMeters = Math.max(0, Math.round((elevationRaw - 20) * 45));

        const currentBiome = biomesGrid[colIdx][rowIdx];
        const biomeData = BIOME_DETAILS[currentBiome] || { name: "未知の地 (Unknown)", desc: "踏破が不可能な地域。" };

        // DOM sets
        document.getElementById('ticker-coord-lat').textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
        document.getElementById('ticker-coord-lon').textContent = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
        document.getElementById('ticker-elevation').textContent = `${elevationMeters.toLocaleString()} m`;
        document.getElementById('ticker-speed').textContent = `${(keys.Shift && player.isMoving ? 'ダッシュ (Run: Fast)' : player.isMoving ? '歩く (Walk: Slow)' : '待機中 (Idle)')}`;

        // Real RGB/HSL debug telemetry row update
        const colorData = satelliteColorsGrid[colIdx][rowIdx] || { r: 0, g: 0, b: 0 };
        const colorHsl = rgbToHsl(colorData.r, colorData.g, colorData.b);
        const colorNode = document.getElementById('ticker-color-val');
        if (colorNode) {
            colorNode.textContent = `R:${colorData.r} G:${colorData.g} B:${colorData.b} / H:${colorHsl.h}° S:${colorHsl.s}% L:${colorHsl.l}%`;
        }

        const badge = document.getElementById('ticker-biome-badge');
        // Reset dynamic style properties first to let standard CSS biomes apply!
        badge.style.backgroundColor = '';
        badge.style.borderColor = '';
        badge.style.color = '';

        const city = citiesGridLookup[`${colIdx}_${rowIdx}`];
        if (city) {
            badge.className = `biome-badge`;
            if (city.type === 'megalopolis') {
                badge.innerHTML = `<span style="text-shadow: 0 0 8px #fbbf24;">🏙️</span> <span style="background: linear-gradient(90deg, #fef08a, #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 800; font-size: 11px;">${escapeHTML(city.name)}</span> <span style="font-size: 7px; font-weight: 800; background: #fbbf24; color: #05070c; padding: 1px 4px; border-radius: 4px; margin-left: 5px; letter-spacing: 0.5px; vertical-align: middle;">10M+ GIANT</span>`;
                badge.style.backgroundColor = 'rgba(30, 41, 59, 0.85)';
                badge.style.borderColor = '#fbbf24';
            } else {
                badge.innerHTML = `🏡 <span style="color: #fed7aa; font-weight: 700; font-size: 11px;">${escapeHTML(city.name)}</span> <span style="font-size: 7px; font-weight: 800; background: #ea580c; color: #ffffff; padding: 1px 4px; border-radius: 4px; margin-left: 5px; letter-spacing: 0.5px; vertical-align: middle;">CAPITAL VILLAGE</span>`;
                badge.style.backgroundColor = 'rgba(20, 15, 10, 0.85)';
                badge.style.borderColor = '#ea580c';
            }
            document.getElementById('ticker-biome-desc').textContent = city.desc;
        } else {
            badge.className = `biome-badge biome-${currentBiome}`;
            badge.innerHTML = `<span>🌍</span> ${biomeData.name}`;
            document.getElementById('ticker-biome-desc').textContent = biomeData.desc;
        }

        // Clock panel numbers
        const hour = Math.floor(timeOfDay);
        const min = Math.floor((timeOfDay - hour) * 60);
        const pad = (num) => String(num).padStart(2, '0');
        document.getElementById('hud-time-val').textContent = `${pad(hour)}:${pad(min)}`;
        
        const timeIcon = document.getElementById('hud-time-icon');
        timeIcon.textContent = (timeOfDay >= 6.0 && timeOfDay < 18.0) ? "☀️" : "🌙";

        const progressFill = document.getElementById('hud-time-fill');
        if (progressFill) {
            progressFill.style.width = `${(timeOfDay / 24.0) * 100}%`;
        }

        // Minimap pulsing indicator update with continuous smooth glide
        const mLocator = document.getElementById('minimap-locator');
        const mGlow = document.getElementById('minimap-locator-glow');
        
        const rect = document.getElementById('minimap-wrapper').getBoundingClientRect();
        const pxX = (((player.gridX % W + W) % W) / W) * rect.width;
        const pxY = (Math.max(0, Math.min(H - 1, player.gridY)) / H) * rect.height;

        mLocator.style.left = `${pxX}px`;
        mLocator.style.top = `${pxY}px`;
        mGlow.style.left = `${pxX}px`;
        mGlow.style.top = `${pxY}px`;
    }

    /**
     * Renders national boundaries lines from local precompiled rings, supporting infinite wrapping.
     */
    function drawNationalBorders(offsetX, offsetY) {
        const showBordersNode = document.getElementById('checkbox-borders');
        if (!showBordersNode || !showBordersNode.checked) return;
        if (!borderFeatures || borderFeatures.length === 0) return;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3.0;
        ctx.setLineDash([3, 4]); // Clean subtle retro dash style
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const shifts = [-W * TILE_SIZE, 0, W * TILE_SIZE];

        shifts.forEach(shiftX => {
            ctx.beginPath();
            borderFeatures.forEach(feature => {
                feature.rings.forEach(ring => {
                    if (ring.length < 2) return;

                    const startX = ring[0].x * TILE_SIZE + offsetX + shiftX;
                    const startY = ring[0].y * TILE_SIZE + offsetY;
                    ctx.moveTo(startX, startY);

                    for (let i = 1; i < ring.length; i++) {
                        const px = ring[i].x * TILE_SIZE + offsetX + shiftX;
                        const py = ring[i].y * TILE_SIZE + offsetY;
                        ctx.lineTo(px, py);
                    }
                });
            });
            ctx.stroke();
        });

        ctx.restore();
    }

    /**
     * Primary 2D Canvas Tiling, Topo shading, Y-sorted billing queues drawing,
     * day/night composite overlays, local lantern bubble, custom weather systems.
     */
    function render2DMap() {
        if (!ctx) return;

        // 1. Reset full screen viewport background
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Viewport drawing pixel offsets
        const offsetX = canvas.width / 2 - camX;
        const offsetY = canvas.height / 2 - camY;

        // Bounding grid ranges visible on screen (plus safety paddings)
        const startCol = Math.floor((-offsetX) / TILE_SIZE) - VIEW_PADDING;
        const endCol = Math.ceil((canvas.width - offsetX) / TILE_SIZE) + VIEW_PADDING;
        const startRow = Math.floor((-offsetY) / TILE_SIZE) - VIEW_PADDING;
        const endRow = Math.ceil((canvas.height - offsetY) / TILE_SIZE) + VIEW_PADDING;

        // Y-sorted Depth Queue for billing decorations and player
        const renderQueue = [];

        const showShadows = document.getElementById('checkbox-shadows').checked;

        // 2. Loop and draw Terrain Grid cells
        for (let r = startRow; r <= endRow; r++) {
            if (r < 0 || r >= H) continue; // clamp polar limits

            const rClamped = r;
            const rClampedNorth = Math.max(0, r - 1);
            const rClampedSouth = Math.min(H - 1, r + 1);

            for (let c = startCol; c <= endCol; c++) {
                // East-West infinite wrapped coordinates
                const cWrapped = (c % W + W) % W;
                const cWrappedWest = (cWrapped - 1 + W) % W;
                const cWrappedEast = (cWrapped + 1) % W;

                const biome = biomesGrid[cWrapped][rClamped];
                
                // Physical screen coords for the tile
                const tileX = c * TILE_SIZE + offsetX;
                const tileY = r * TILE_SIZE + offsetY;

                // A. Draw base pre-rendered biome tile Canvas template
                const tileCanvas = getTerrainTileCanvas(biome, waveFrame);
                ctx.drawImage(tileCanvas, tileX, tileY, TILE_SIZE, TILE_SIZE);

                // B. Draw Topo-relief outline shadows/highlights!
                // Compares relative elevation values with West/North grid neighbors!
                const curElev = elevationGrid[rClamped * W + cWrapped];
                const westElev = elevationGrid[rClamped * W + cWrappedWest];
                const northElev = elevationGrid[rClampedNorth * W + cWrapped];

                // If not an ocean floor
                if (curElev > 20) {
                    // West highlight / shadow check
                    if (curElev > westElev) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.24)'; // sunrise highlight wall
                        ctx.fillRect(tileX, tileY, 2, TILE_SIZE);
                    } else if (curElev < westElev && showShadows) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'; // sunset shadow wall
                        ctx.fillRect(tileX, tileY, 3, TILE_SIZE);
                    }

                    // North highlight / shadow check
                    if (curElev > northElev) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
                        ctx.fillRect(tileX, tileY, TILE_SIZE, 2);
                    } else if (curElev < northElev && showShadows) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
                        ctx.fillRect(tileX, tileY, TILE_SIZE, 3);
                    }
                }

                // C. Collect decoration elements to add to Y-sorted Queue!
                // Uses deterministic PRNG based on coordinates coordinates!
                const seedVal = Math.abs(Math.sin(cWrapped * 12.9898 + rClamped * 78.233) * 43758.5453) % 1.0;
                let assetType = null;

                if (biome === 'forest' && seedVal < 0.62) assetType = 'forest_tree';
                else if (biome === 'snowfield' && seedVal < 0.32) assetType = 'snow_tree';
                else if (biome === 'desert' && seedVal < 0.16) assetType = 'desert_cactus';
                else if (biome === 'walkableHills' && seedVal < 0.42) assetType = 'hill_rock';
                else if (biome === 'impassableMountains') assetType = 'mountain_peak';
                else if (biome === 'plains' && seedVal < 0.08) assetType = 'grass_tuft';
                else if (biome === 'coralReef' && seedVal < 0.35) assetType = 'coral_plant';
                else if (biome === 'megalopolis') assetType = 'megalopolis_castle';
                else if (biome === 'village') assetType = 'village_cottage';

                if (assetType) {
                    const sortY = (r + 1) * TILE_SIZE; // sort bottom coordinate
                    let drawWidth = TILE_SIZE;
                    let drawHeight = TILE_SIZE;
                    let dx = tileX;
                    let dy = tileY;

                    // Size and offsets configurations:
                    if (assetType === 'forest_tree' || assetType === 'snow_tree' || assetType === 'megalopolis_castle') {
                        drawWidth = TILE_SIZE;
                        drawHeight = TILE_SIZE * 1.5; // taller 48x72
                        dy = (r + 1) * TILE_SIZE - drawHeight + offsetY;
                        
                        if (assetType !== 'megalopolis_castle') {
                            // Add organic slight offsets to clusters for trees only
                            const offsetSeedX = (seedVal * 2.0 - 1.0) * 8;
                            dx += offsetSeedX;
                        }
                    }
                    else if (assetType === 'mountain_peak') {
                        drawWidth = TILE_SIZE * 2.0; // massive 96x96
                        drawHeight = TILE_SIZE * 2.0;
                        dx = (c - 0.5) * TILE_SIZE + offsetX;
                        dy = (r + 1) * TILE_SIZE - drawHeight + offsetY;
                    }
                    else if (assetType !== 'coral_plant' && assetType !== 'grass_tuft' && assetType !== 'village_cottage') {
                        // Standard decorations get horizontal offset, town cottage stays centered!
                        const offsetSeedX = (seedVal * 2.0 - 1.0) * 8;
                        dx += offsetSeedX;
                    }

                    renderQueue.push({
                        type: 'decoration',
                        assetType: assetType,
                        x: dx,
                        y: dy,
                        sortY: sortY,
                        seed: seedVal
                    });
                }
            }
        }

        // 2.5. Draw National Borders (Vector Lines Layer)
        drawNationalBorders(offsetX, offsetY);

        // 3. Push Player/Hero to Y-Sorted Queue!
        const playerPixelX = player.gridX * TILE_SIZE;
        const playerPixelY = player.gridY * TILE_SIZE;
        
        const heroDrawWidth = 48;
        const heroDrawHeight = 48;
        
        // Centered offset coordinates
        const heroDrawX = playerPixelX - heroDrawWidth / 2 + TILE_SIZE / 2 + offsetX;
        const heroDrawY = playerPixelY - heroDrawHeight + TILE_SIZE / 2 + offsetY;
        const heroSortY = playerPixelY + TILE_SIZE / 2;

        renderQueue.push({
            type: 'player',
            x: heroDrawX,
            y: heroDrawY,
            sortY: heroSortY
        });

        // 4. Sort rendering elements by their physical anchor base coordinate Y!
        renderQueue.sort((a, b) => a.sortY - b.sortY);

        // 5. Loop and draw Y-sorted elements
        renderQueue.forEach(item => {
            if (item.type === 'decoration') {
                const decCanvas = Assets.getDecorationCanvas(item.assetType);
                
                // Draw drop shadow under trees/cacti/mountains/castles!
                if (showShadows && item.assetType !== 'coral_plant' && item.assetType !== 'grass_tuft') {
                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
                    ctx.scale(1, 0.45); // squish shape horizontally
                    
                    let shadowX = item.x + TILE_SIZE / 2;
                    let shadowY = (item.sortY + offsetY) / 0.45 - 6;
                    let sRadius = 12;
                    if (item.assetType === 'mountain_peak') sRadius = 32;
                    else if (item.assetType === 'megalopolis_castle') sRadius = 16;

                    ctx.beginPath();
                    ctx.arc(shadowX, shadowY, sRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Draw main decoration sprite canvas
                let drawW = TILE_SIZE;
                let drawH = TILE_SIZE;
                if (item.assetType === 'forest_tree' || item.assetType === 'snow_tree' || item.assetType === 'megalopolis_castle') {
                    drawW = TILE_SIZE; drawH = TILE_SIZE * 1.5;
                } else if (item.assetType === 'mountain_peak') {
                    drawW = TILE_SIZE * 2; drawH = TILE_SIZE * 2;
                }
                
                ctx.drawImage(decCanvas, item.x, item.y, drawW, drawH);
            }
            else if (item.type === 'player') {
                // Draw Hero drop shadow first!
                if (showShadows) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
                    ctx.scale(1, 0.45);
                    ctx.beginPath();
                    ctx.arc(item.x + 24, (item.sortY + offsetY) / 0.45 - 2, 11, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Draw active animated Hero sprite frame canvas
                const heroCanvas = Assets.getHeroCanvas(player.direction, player.state, player.travelMode);
                ctx.drawImage(heroCanvas, item.x, item.y, 48, 48);
            }
        });

        // 6. Draw Day/Night cycle lighting tint overlays with warm hero lantern bubble at night!
        drawDayNightOverlay(heroDrawX + 24, heroDrawY + 36);

        // 7. Draw floating screen weather particles!
        const drawWeather = document.getElementById('checkbox-weather').checked;
        if (drawWeather) {
            drawWeatherParticles();
        }
    }

    /**
     * Builds offscreen lighting templates to compose full screen day/night color tints
     * and carve out dynamic transparent circular lantern bubbles around player coordinates.
     */
    function drawDayNightOverlay(playerScreenX, playerScreenY) {
        // Clear offscreen context
        lightMaskCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Determine base color values based on the timeOfDay clock
        let tintColor = 'rgba(0, 0, 0, 0)';
        let applyLantern = false;

        if (timeOfDay >= 6.0 && timeOfDay < 17.0) {
            // Day light (very mild warm sun glow)
            const factor = (timeOfDay - 6.0) / 11.0;
            const intensity = Math.sin(factor * Math.PI) * 0.04;
            tintColor = `rgba(251, 191, 36, ${intensity})`;
        }
        else if (timeOfDay >= 17.0 && timeOfDay < 19.5) {
            // Sunset twilight (rich orange-magenta tint)
            const factor = (timeOfDay - 17.0) / 2.5;
            const r = Math.round(220 - factor * 200);
            const g = Math.round(80 - factor * 65);
            const b = Math.round(20 + factor * 25);
            const opacity = 0.04 + factor * 0.44;
            tintColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            
            // Sunset starts dynamic soft lantern glow!
            if (factor > 0.4) applyLantern = true;
        }
        else if (timeOfDay >= 19.5 || timeOfDay < 4.5) {
            // Deep Night darkness (cold deep navy blue)
            const factor = (timeOfDay >= 19.5) ? (timeOfDay - 19.5) / 9.0 : (timeOfDay + 4.5) / 9.0;
            const sineFactor = Math.sin(factor * Math.PI);
            const opacity = 0.48 + sineFactor * 0.14; // deep night is dark!
            tintColor = `rgba(10, 15, 45, ${opacity})`;
            applyLantern = true;
        }
        else {
            // Sunrise dawn (soft rose transition)
            const factor = (timeOfDay - 4.5) / 1.5;
            const opacity = 0.48 * (1.0 - factor);
            tintColor = `rgba(186, 104, 200, ${opacity * 0.4})`;
            if (factor < 0.6) applyLantern = true;
        }

        // Draw overlay
        if (tintColor !== 'rgba(0,0,0,0)') {
            if (applyLantern) {
                // 1. Fill offscreen context with solid dark night color tint
                lightMaskCtx.fillStyle = tintColor;
                lightMaskCtx.fillRect(0, 0, canvas.width, canvas.height);

                // 2. Carve a transparent circle around the player using destination-out composite mode!
                lightMaskCtx.save();
                lightMaskCtx.globalCompositeOperation = 'destination-out';

                const glowRadius = 145; // lantern size radius
                const grad = lightMaskCtx.createRadialGradient(
                    playerScreenX, playerScreenY, 20,
                    playerScreenX, playerScreenY, glowRadius
                );
                grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)'); // fully carved center
                grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.7)');
                grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)'); // smooth edge fade

                lightMaskCtx.fillStyle = grad;
                lightMaskCtx.beginPath();
                lightMaskCtx.arc(playerScreenX, playerScreenY, glowRadius, 0, Math.PI * 2);
                lightMaskCtx.fill();
                lightMaskCtx.restore();

                // 3. Draw a secondary warm soft yellow gradient aura over the cut area!
                const lightGrad = ctx.createRadialGradient(
                    playerScreenX, playerScreenY, 15,
                    playerScreenX, playerScreenY, glowRadius - 10
                );
                lightGrad.addColorStop(0, 'rgba(253, 224, 71, 0.16)');
                lightGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.06)');
                lightGrad.addColorStop(1.0, 'rgba(253, 224, 71, 0.0)');

                // Compose night mask first onto the primary viewport context!
                ctx.drawImage(lightMaskCanvas, 0, 0);

                // Paint the soft warm yellow aura on top
                ctx.fillStyle = lightGrad;
                ctx.beginPath();
                ctx.arc(playerScreenX, playerScreenY, glowRadius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Simple solid screen overlay (no complex composite required!)
                ctx.fillStyle = tintColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    }

    /**
     * Renders floating screen space weather particles.
     */
    function drawWeatherParticles() {
        const drawSystem = (opacity, color, size, type) => {
            if (opacity <= 0.01) return;
            ctx.fillStyle = color;
            
            weather.particles.forEach(p => {
                const px = p.x * canvas.width;
                const py = p.y * canvas.height;

                ctx.save();
                ctx.globalAlpha = opacity * 0.8;
                
                if (type === 'snow') {
                    ctx.beginPath();
                    ctx.arc(px, py, p.size * 0.6, 0, Math.PI * 2);
                    ctx.fill();
                }
                else if (type === 'leaves') {
                    // Draw a cute small curved leaf vector shape!
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(px, py, p.size, p.angle, p.angle + Math.PI / 2);
                    ctx.stroke();
                }
                else if (type === 'sand') {
                    // Draw a thin golden blowing line segment
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px - 14 - p.size * 4, py + 2);
                    ctx.stroke();
                }
                ctx.restore();
            });
        };

        drawSystem(weather.snowOpacity, '#ffffff', 2.0, 'snow');
        drawSystem(weather.leavesOpacity, '#34d399', 1.8, 'leaves');
        drawSystem(weather.sandOpacity, '#f59e0b', 1.5, 'sand');
    }

    return {
        teleportPlayerToCoords
    };
})();

// Export for global browser context
window.GameEngine = GameEngine;
