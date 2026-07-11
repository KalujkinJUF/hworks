// Звуковые эффекты (звонок/кнопки) через WebAudio — без бинарных файлов, работают
// офлайн в Electron. Публичный API: window.sfx
//   click()          — короткий клик кнопки
//   ringOutgoing()   — гудки вызова (исходящий), зациклено до stopRing()
//   ringIncoming()   — рингтон входящего звонка, зациклено до stopRing()
//   stopRing()       — остановить любой цикл звонка
//   callConnect()    — короткий сигнал «соединено»
//   callEnd()        — короткий сигнал «завершено»
//
// AudioContext создаётся лениво и разблокируется на первом жесте пользователя
// (браузеры запрещают автозвук без взаимодействия).

(function () {
    'use strict';

    let ctx = null;
    let ringTimer = null;

    function ac() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
        }
        if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
        return ctx;
    }

    // Один тон с ADSR-огибающей. freq — Гц, dur — сек, type — форма волны, vol — громкость.
    function tone(freq, start, dur, type, vol) {
        const c = ac();
        if (!c) return;
        const t0 = c.currentTime + start;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        const peak = vol == null ? 0.18 : vol;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    }

    function click() {
        tone(660, 0, 0.05, 'square', 0.10);
    }

    function callConnect() {
        stopRing();
        tone(523, 0, 0.09, 'sine', 0.16);   // C5
        tone(784, 0.09, 0.14, 'sine', 0.16); // G5 — восходящий «дзынь»
    }

    function callEnd() {
        stopRing();
        tone(494, 0, 0.10, 'sine', 0.16);   // B4
        tone(330, 0.10, 0.18, 'sine', 0.16); // E4 — нисходящий
    }

    // Кто-то вошёл в голосовой канал/звонок — короткий восходящий «блип».
    function userJoin() {
        tone(587, 0, 0.07, 'sine', 0.13);    // D5
        tone(880, 0.07, 0.10, 'sine', 0.13); // A5
    }

    // Кто-то вышел — короткий нисходящий «блип».
    function userLeave() {
        tone(587, 0, 0.07, 'sine', 0.13);    // D5
        tone(392, 0.07, 0.12, 'sine', 0.13); // G4
    }

    // Исходящий: длинный гудок ~1с, пауза ~2.4с (как телефонный ringback)
    function ringOutgoing() {
        stopRing();
        const beat = () => { tone(425, 0, 0.9, 'sine', 0.12); };
        beat();
        ringTimer = setInterval(beat, 3400);
    }

    // Входящий: двойная трель каждые ~3с
    function ringIncoming() {
        stopRing();
        const beat = () => {
            tone(660, 0, 0.35, 'triangle', 0.16);
            tone(660, 0.5, 0.35, 'triangle', 0.16);
        };
        beat();
        ringTimer = setInterval(beat, 3000);
    }

    function stopRing() {
        if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
    }

    // Разблокировка звука на первом взаимодействии (для входящего звонка без жеста)
    function unlock() { ac(); }
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
        window.addEventListener(ev, unlock, { once: false, passive: true })
    );

    window.sfx = { click, ringOutgoing, ringIncoming, stopRing, callConnect, callEnd, userJoin, userLeave };
})();
