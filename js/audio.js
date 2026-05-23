/**
 * Retro Earth Explorer - Audio Module
 * Generates procedural 8-bit synthesizer background music and organic contextual sound effects
 * using the modern clientside Web Audio API. Requires zero external audio files!
 */

const RetroAudio = (() => {
    let audioCtx = null;
    let masterGain = null;
    let musicGain = null;
    let sfxGain = null;

    // Music State variables
    let isBgmPlaying = false;
    let currentNoteIndex = 0;
    let bgmIntervalId = null;
    let tempoBPM = 95;
    let currentChordIndex = 0;

    // A classic loopable warm RPG/DQ melody (in C major/A minor pentatonic scale)
    // Notes represented in frequencies (Hz). Standard A4 = 440Hz
    const NOTES = {
        C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00,
        C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00, B4: 493.88,
        C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00
    };

    // Chord Progression roots (Bass support)
    // Progression: C major - G major - A minor - F major
    const BASS_PROGRESSION = [
        [NOTES.C3, NOTES.G3], // C Chord
        [NOTES.G3, NOTES.D3], // G Chord
        [NOTES.A3, NOTES.E3], // Am Chord
        [NOTES.F3, NOTES.C3]   // F Chord
    ];

    // The beautiful main field theme melody (Notes and Durations in beats: 1 = quarter note)
    const FIELD_MELODY = [
        // Measure 1: C major
        { note: 'E4', dur: 1 }, { note: 'G4', dur: 1 }, { note: 'C5', dur: 1.5 }, { note: 'D5', dur: 0.5 },
        { note: 'E5', dur: 1 }, { note: 'D5', dur: 1 }, { note: 'C5', dur: 2 },
        // Measure 2: G major
        { note: 'D5', dur: 1 }, { note: 'B4', dur: 1 }, { note: 'G4', dur: 1.5 }, { note: 'A4', dur: 0.5 },
        { note: 'B4', dur: 1 }, { note: 'A4', dur: 1 }, { note: 'G4', dur: 2 },
        // Measure 3: A minor
        { note: 'C5', dur: 1 }, { note: 'A4', dur: 1 }, { note: 'E4', dur: 1.5 }, { note: 'G4', dur: 0.5 },
        { note: 'A4', dur: 1 }, { note: 'C5', dur: 1 }, { note: 'E5', dur: 2 },
        // Measure 4: F major
        { note: 'D5', dur: 1 }, { note: 'C5', dur: 1 }, { note: 'A4', dur: 1.5 }, { note: 'G4', dur: 0.5 },
        { note: 'E4', dur: 1 }, { note: 'G4', dur: 1 }, { note: 'C5', dur: 2 }
    ];

    /**
     * Lazy initializes the Audio Context when the user interacts with the page.
     */
    function initAudio() {
        if (audioCtx) return;

        try {
            // Standard AudioContext initialization
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();

            // Set up a structured gain node bus topology
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.6; // comfortable base volume
            masterGain.connect(audioCtx.destination);

            musicGain = audioCtx.createGain();
            musicGain.gain.value = 0.35; // keep BGM pleasant and quiet
            musicGain.connect(masterGain);

            sfxGain = audioCtx.createGain();
            sfxGain.gain.value = 0.5; // step feedback is clearly audible
            sfxGain.connect(masterGain);
        } catch (e) {
            console.error('Web Audio API is not supported on this browser context:', e);
        }
    }

    /**
     * Plays a synth note with soft envelopes (to avoid 8-bit clicks/harshness).
     */
    function playSynthNote(freq, startTime, duration, type = 'triangle', volume = 0.15) {
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.value = freq;

        // Apply a gentle lowpass filter to warm up square or triangle waves
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 950; // soft and nostalgic frequency cut-off

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(musicGain);

        // Envelope configuration (Attack-Decay-Sustain-Release)
        const attack = 0.05;
        const decay = 0.1;
        const release = 0.15;
        const sustainVol = volume * 0.7;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + attack);
        gainNode.gain.exponentialRampToValueAtTime(sustainVol, startTime + attack + decay);
        gainNode.gain.setValueAtTime(sustainVol, startTime + duration - release);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    /**
     * Steps through the loopable main theme sequencer.
     */
    function tickBgmSequencer() {
        if (!isBgmPlaying || !audioCtx) return;

        const beatDuration = 60 / tempoBPM; // duration of a quarter note beat
        const now = audioCtx.currentTime;

        // Retrieve current melody details
        const noteData = FIELD_MELODY[currentNoteIndex];
        const freq = NOTES[noteData.note];
        const durationSeconds = noteData.dur * beatDuration;

        // 1. Play Lead voice (Triangle oscillator for cute flute-like vintage melody)
        playSynthNote(freq, now, durationSeconds - 0.02, 'triangle', 0.22);

        // 2. Play Bass voice periodically on the first beat of chord cycles
        // Each chord lasts 2 measures (8 beats total, or 4 notes of average durations)
        if (currentNoteIndex % 4 === 0) {
            const chordIdx = Math.floor(currentNoteIndex / 8) % BASS_PROGRESSION.length;
            const bassNotes = BASS_PROGRESSION[chordIdx];
            // Bass root note (Sine wave for sub-like warm solid base support)
            playSynthNote(bassNotes[0], now, beatDuration * 2.0, 'sine', 0.18);
            // Bass fifth note scheduled 1 beat later
            playSynthNote(bassNotes[1], now + beatDuration, beatDuration * 1.0, 'sine', 0.12);
        }

        // Advance note pointer
        currentNoteIndex = (currentNoteIndex + 1) % FIELD_MELODY.length;

        // Schedule next note tick
        const delayMs = durationSeconds * 1000;
        bgmIntervalId = setTimeout(tickBgmSequencer, delayMs);
    }

    return {
        /**
         * Initialize audio and trigger background music loop.
         */
        toggleBgm(forceState = null) {
            initAudio();
            if (!audioCtx) return false;

            // Resume audio context if suspended (browser security policies)
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const targetState = (forceState !== null) ? forceState : !isBgmPlaying;
            
            if (targetState && !isBgmPlaying) {
                isBgmPlaying = true;
                currentNoteIndex = 0;
                tickBgmSequencer();
            } else if (!targetState && isBgmPlaying) {
                isBgmPlaying = false;
                if (bgmIntervalId) {
                    clearTimeout(bgmIntervalId);
                    bgmIntervalId = null;
                }
            }
            return isBgmPlaying;
        },

        isMusicPlaying() {
            return isBgmPlaying;
        },

        setMasterVolume(val) {
            initAudio();
            if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, val));
        },

        setMusicVolume(val) {
            initAudio();
            if (musicGain) musicGain.gain.value = Math.max(0, Math.min(1, val)) * 0.35;
        },

        setSfxVolume(val) {
            initAudio();
            if (sfxGain) sfxGain.gain.value = Math.max(0, Math.min(1, val)) * 0.5;
        },

        /**
         * Plays a short synthetic step sound customized for the current walking biome.
         */
        playStepSound(biomeType) {
            initAudio();
            if (!audioCtx || audioCtx.state === 'suspended') return;

            const now = audioCtx.currentTime;

            if (biomeType === 'plains') {
                // Grass: Gentle rustle of filtered white noise
                const bufferSize = audioCtx.sampleRate * 0.08; // 80ms sound
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2.0 - 1.0;
                }

                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;

                const filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 1400; // middle grass crispiness
                filter.Q.value = 3.0;

                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(sfxGain);
                noise.start(now);
            }
            else if (biomeType === 'forest') {
                // Forest: A double crunch rustle with wood undertones
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(110, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

                osc.connect(gain);
                gain.connect(sfxGain);
                osc.start(now);
                osc.stop(now + 0.1);

                // Add a small noise brush
                const bufferSize = audioCtx.sampleRate * 0.09;
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2.0 - 1.0;

                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;

                const filter = audioCtx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 1800;
                
                const noiseGain = audioCtx.createGain();
                noiseGain.gain.setValueAtTime(0.04, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(sfxGain);
                noise.start(now);
            }
            else if (biomeType === 'walkableHills') {
                // Hills: Deeper hollow step pop (dry soil)
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(145, now);
                osc.frequency.linearRampToValueAtTime(80, now + 0.12);

                gain.gain.setValueAtTime(0.14, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

                osc.connect(gain);
                gain.connect(sfxGain);
                osc.start(now);
                osc.stop(now + 0.12);
            }
            else if (biomeType === 'snowfield') {
                // Snowfield: High-pitched crunch squeak (like walking on deep frozen snow)
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(3200, now);
                osc.frequency.exponentialRampToValueAtTime(1800, now + 0.07);

                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

                osc.connect(gain);
                gain.connect(sfxGain);
                osc.start(now);
                osc.stop(now + 0.07);

                // Add a small frosty white noise cluster
                const bufferSize = audioCtx.sampleRate * 0.06;
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2.0 - 1.0;

                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;
                
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 4500;
                filter.Q.value = 5.0;

                const noiseGain = audioCtx.createGain();
                noiseGain.gain.setValueAtTime(0.06, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(sfxGain);
                noise.start(now);
            }
            else if (biomeType === 'desert') {
                // Desert: Soft sandy scrape whisper
                const bufferSize = audioCtx.sampleRate * 0.12; // longer drag sound
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2.0 - 1.0;
                }

                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;

                const filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 800; // lower warm sand tone
                filter.Q.value = 2.0;

                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(sfxGain);
                noise.start(now);
            }
            else if (biomeType === 'megalopolis' || biomeType === 'village') {
                // Cobblestone town step: Crisp solid pavement shoe click-clack pop
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);

                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

                osc.connect(gain);
                gain.connect(sfxGain);
                osc.start(now);
                osc.stop(now + 0.07);
            }
        },

        /**
         * Plays a short, high-pitched retro bump sound.
         */
        playBumpSound() {
            initAudio();
            if (!audioCtx || audioCtx.state === 'suspended') return;

            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(95, now);
            osc.frequency.setValueAtTime(80, now + 0.05);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

            osc.connect(gain);
            gain.connect(sfxGain);
            osc.start(now);
            osc.stop(now + 0.14);
        },

        /**
         * Plays a gorgeous rising synthetic arpeggio sound effect (Teleporting!).
         */
        playTeleportSound() {
            initAudio();
            if (!audioCtx || audioCtx.state === 'suspended') return;

            const now = audioCtx.currentTime;
            const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major ascending arpeggio

            notes.forEach((freq, index) => {
                const stepTime = now + index * 0.06;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'sine';
                osc.frequency.value = freq;

                // Add a small bandpass filter to give a magical space-y feel
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = freq * 1.5;

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(sfxGain);

                gain.gain.setValueAtTime(0, stepTime);
                gain.gain.linearRampToValueAtTime(0.12, stepTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, stepTime + 0.18);

                osc.start(stepTime);
                osc.stop(stepTime + 0.18);
            });
        }
    };
})();

// Export for global browser context
window.RetroAudio = RetroAudio;
