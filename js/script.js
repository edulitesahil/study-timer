/* ================================================================
   STILLROOM — content and behaviour are kept here for easy editing.
   Change the values in APP_CONFIG to personalize the experience.
   No framework, backend, or build step is required.
   ================================================================ */

const APP_CONFIG = {
  personalName: 'Sahil Patra',
  heroEyebrow: 'YOUR PERSONAL PRODUCTIVITY SPACE',
  heroSubtitle: 'Slow down. Stay focused. Make every minute count.',
  defaultDurations: { focus: 25, short: 5, long: 15 },
  defaultDailyGoal: 120,
  quotes: [
    'Discipline creates freedom.',
    'One session at a time.',
    'Small steps. Big results.',
    'Focus on progress, not perfection.',
    'Your future self will thank you.',
    'A little progress each day adds up.',
    'Give your attention to what matters.',
    'You are allowed to move at your own pace.'
  ],
  // These are built-in, synthesized ambience presets (no external audio
  // files or streaming service required). Edit titles, descriptions and
  // chord frequencies to make your own sound palette.
  musicTracks: [
    {
      title: 'Midnight Study',
      subtitle: 'Soft keys · distant static · slow nights',
      chords: [[110, 164.81, 220, 261.63], [98, 146.83, 196, 246.94], [130.81, 164.81, 196, 261.63], [87.31, 130.81, 174.61, 220]],
      noise: 0.012,
      tone: 0.052
    },
    {
      title: 'Rain on Glass',
      subtitle: 'Muted chords · soft texture · rainy windows',
      chords: [[130.81, 164.81, 196, 246.94], [110, 146.83, 174.61, 220], [123.47, 155.56, 185, 233.08], [98, 130.81, 164.81, 196]],
      noise: 0.023,
      tone: 0.043
    },
    {
      title: 'After Hours',
      subtitle: 'Low warm tones · quiet city · late focus',
      chords: [[82.41, 123.47, 164.81, 196], [92.5, 138.59, 185, 220], [73.42, 110, 146.83, 174.61], [87.31, 130.81, 164.81, 207.65]],
      noise: 0.009,
      tone: 0.058
    }
  ],
  storageKeys: {
    settings: 'stillroom_settings_v1',
    stats: 'stillroom_stats_v1',
    timer: 'stillroom_timer_v1',
    music: 'stillroom_music_v1'
  }
};

(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = APP_CONFIG.storageKeys;
  const RING_CIRCUMFERENCE = 2 * Math.PI * 130;
  const DAILY_RING_CIRCUMFERENCE = 2 * Math.PI * 94;
  const TIMER_MODES = {
    focus: { label: 'FOCUS SESSION', durationKey: 'focus', bottom: 'MIN SESSION' },
    short: { label: 'SHORT BREAK', durationKey: 'short', bottom: 'MIN BREAK' },
    long: { label: 'LONG BREAK', durationKey: 'long', bottom: 'MIN BREAK' }
  };

  const defaultSettings = {
    durations: { ...APP_CONFIG.defaultDurations },
    dailyGoal: APP_CONFIG.defaultDailyGoal,
    notificationSound: true,
    autoBreaks: false,
    autoFocus: false,
    darkMode: true
  };
  const defaultStats = {
    totalFocusSessions: 0,
    totalFocusMinutes: 0,
    currentStreak: 0,
    lastStudyDate: null,
    daily: { date: localDateKey(), focusMinutes: 0, sessions: 0 }
  };

  let settings = loadObject(STORAGE.settings, defaultSettings);
  settings = mergeSettings(settings);
  let stats = mergeStats(loadObject(STORAGE.stats, defaultStats));
  normalizeDailyStats();

  let timer = loadObject(STORAGE.timer, null);
  let mode = 'focus';
  let remainingMs = APP_CONFIG.defaultDurations.focus * 60_000;
  let durationMs = remainingMs;
  let endsAt = null;
  let isRunning = false;
  let tickerId = null;
  let quoteIndex = 0;
  let quoteTimerId = null;
  let toastTimerId = null;
  let dailyRolloverId = null;
  let knownDateKey = localDateKey();

  let musicIndex = 0;
  let musicIsPlaying = false;
  let audioContext = null;
  let masterGain = null;
  let analyser = null;
  let noiseGain = null;
  let voiceOscillators = [];
  let chordTimerId = null;
  let visualizerFrameId = null;
  let musicNoiseBuffer = null;
  let ambientReady = false;
  let storedMusic = loadObject(STORAGE.music, { volume: 38, track: 0 });
  let musicVolume = clamp(Number(storedMusic.volume) || 0, 0, 100);
  musicIndex = clamp(Number(storedMusic.track) || 0, 0, APP_CONFIG.musicTracks.length - 1);

  const els = {
    heroEyebrow: $('#heroEyebrow'), heroSubtitle: $('#heroSubtitle'), heroQuote: $('#heroQuote'),
    heroStart: $('#heroStart'), timer: $('#timer'), timerDisplay: $('#timerDisplay'), timerModeLabel: $('#timerModeLabel'),
    timerState: $('#timerState'), timerDurationLabel: $('#timerDurationLabel'), timerBottomStatus: $('#timerBottomStatus'),
    timerCardBottom: $('.timer-card-bottom'), timerRingWrap: $('#timerRingWrap'), ringProgress: $('#ringProgress'),
    start: $('#startButton'), pause: $('#pauseButton'), reset: $('#resetButton'), skip: $('#skipButton'),
    modeButtons: $$('.mode-button'), sessionCount: $('#sessionCountLabel'), cycleNumber: $('#cycleNumber'),
    cycleDots: $('#cycleDots'), cycleCaption: $('#cycleCaption'), timerQuote: $('#timerQuote'),
    streak: $('#streakValue'), sessions: $('#sessionsValue'), focusTime: $('#focusTimeValue'), goal: $('#goalValue'),
    todayDate: $('#todayDate'), dailyMinutes: $('#dailyMinutes'), dailyGoalText: $('#dailyGoalText'),
    dailyPercent: $('#dailyPercent'), dailyRingProgress: $('#dailyRingProgress'), dailyRingPercent: $('#dailyRingPercent'),
    dailyProgressBar: $('#dailyProgressBar'), dailyMessage: $('#dailyMessage'), remainingTime: $('#remainingTime'),
    dailySessions: $('#dailySessions'), dailyGoalStatus: $('#dailyGoalStatus'),
    trackTitle: $('#trackTitle'), trackSubtitle: $('#trackSubtitle'), musicHint: $('#musicHint'),
    musicPlay: $('#musicPlay'), previousTrack: $('#previousTrack'), nextTrack: $('#nextTrack'),
    volume: $('#volumeSlider'), volumeLabel: $('#volumeLabel'), visualizer: $('#visualizer'), record: $('.record-art'),
    audio: $('#musicAudio'), toast: $('#toast'), menuToggle: $('#menuToggle'), nav: $('#primaryNav'),
    focusDuration: $('#focusDuration'), shortDuration: $('#shortDuration'), longDuration: $('#longDuration'),
    dailyGoalInput: $('#dailyGoalInput'), notificationSound: $('#notificationSound'), autoBreaks: $('#autoBreaks'),
    autoFocus: $('#autoFocus'), darkMode: $('#darkMode'), settingsSaveNote: $('#settingsSaveNote'),
    yearNow: $('#yearNow'), closingQuote: $('#closingQuote')
  };

  function loadObject(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`Could not read ${key} from localStorage.`, error);
      return fallback;
    }
  }
  function saveObject(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn(`Could not save ${key} to localStorage.`, error); }
  }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  function daysBetween(firstKey, secondKey) {
    if (!firstKey || !secondKey) return Infinity;
    const [fy, fm, fd] = firstKey.split('-').map(Number);
    const [sy, sm, sd] = secondKey.split('-').map(Number);
    const first = Date.UTC(fy, fm - 1, fd);
    const second = Date.UTC(sy, sm - 1, sd);
    return Math.round((second - first) / 86_400_000);
  }
  function mergeSettings(saved) {
    return {
      ...defaultSettings,
      ...saved,
      durations: { ...defaultSettings.durations, ...(saved?.durations || {}) }
    };
  }
  function mergeStats(saved) {
    return {
      ...defaultStats,
      ...saved,
      daily: { ...defaultStats.daily, ...(saved?.daily || {}) }
    };
  }
  function saveSettings() { saveObject(STORAGE.settings, settings); }
  function saveStats() { saveObject(STORAGE.stats, stats); }
  function saveTimer() {
    saveObject(STORAGE.timer, { mode, remainingMs, durationMs, isRunning, endsAt });
  }
  function normalizeDailyStats() {
    const today = localDateKey();
    if (stats.daily.date !== today) stats.daily = { date: today, focusMinutes: 0, sessions: 0 };
    if (stats.lastStudyDate && daysBetween(stats.lastStudyDate, today) > 1) stats.currentStreak = 0;
    saveStats();
  }
  function getCurrentStreak() {
    if (!stats.lastStudyDate) return 0;
    const gap = daysBetween(stats.lastStudyDate, localDateKey());
    return gap <= 1 ? stats.currentStreak : 0;
  }

  function init() {
    applyContent();
    restoreTimer();
    applySettingsToInputs();
    applyTheme();
    renderAll();
    bindEvents();
    initRevealAnimations();
    initNavHighlight();
    startQuoteRotation();
    updateDateLabel();
    startDailyRolloverWatcher();
    els.yearNow.textContent = String(new Date().getFullYear());
    document.title = `Stillroom — Focus by ${APP_CONFIG.personalName}`;
  }

  function applyContent() {
    els.heroEyebrow.textContent = APP_CONFIG.heroEyebrow;
    els.heroSubtitle.textContent = APP_CONFIG.heroSubtitle;
    const firstQuote = APP_CONFIG.quotes[0] || 'One session at a time.';
    els.heroQuote.textContent = firstQuote;
    els.timerQuote.textContent = APP_CONFIG.quotes[1] || firstQuote;
    els.closingQuote.textContent = APP_CONFIG.quotes[3] || firstQuote;
    const footerCredit = $('.footer-credit');
    if (footerCredit) footerCredit.innerHTML = `A QUIET SPACE BY <b>${escapeHtml(APP_CONFIG.personalName.toUpperCase())}</b> <span>© <span id="yearNow">${new Date().getFullYear()}</span></span>`;
    els.yearNow = $('#yearNow');
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function restoreTimer() {
    if (!timer || !TIMER_MODES[timer.mode]) {
      setMode('focus', false);
      return;
    }
    mode = timer.mode;
    durationMs = getModeDuration(mode);
    if (timer.isRunning && Number.isFinite(timer.endsAt)) {
      endsAt = timer.endsAt;
      remainingMs = Math.max(0, endsAt - Date.now());
      isRunning = true;
      if (remainingMs <= 0) finishSession();
      else startTicker();
    } else {
      remainingMs = clamp(Number(timer.remainingMs) || durationMs, 0, durationMs);
      endsAt = null;
      isRunning = false;
    }
    saveTimer();
  }
  function getModeDuration(selectedMode = mode) {
    const key = TIMER_MODES[selectedMode].durationKey;
    const minutes = Number(settings.durations[key]) || APP_CONFIG.defaultDurations[key];
    return clamp(minutes, 1, selectedMode === 'focus' ? 180 : selectedMode === 'short' ? 60 : 90) * 60_000;
  }
  function setMode(nextMode, persist = true) {
    if (!TIMER_MODES[nextMode]) return;
    stopTicker();
    mode = nextMode;
    durationMs = getModeDuration(mode);
    remainingMs = durationMs;
    endsAt = null;
    isRunning = false;
    if (persist) saveTimer();
    renderTimer();
    renderCycle();
    document.body.dataset.focus = 'false';
  }
  function startTimer() {
    if (isRunning) return;
    if (remainingMs <= 0) remainingMs = durationMs;
    endsAt = Date.now() + remainingMs;
    isRunning = true;
    document.body.dataset.focus = mode === 'focus' ? 'true' : 'false';
    startTicker();
    saveTimer();
    renderTimer();
  }
  function pauseTimer() {
    if (!isRunning) return;
    remainingMs = Math.max(0, endsAt - Date.now());
    isRunning = false;
    endsAt = null;
    stopTicker();
    saveTimer();
    renderTimer();
    document.body.dataset.focus = 'false';
  }
  function resetTimer() {
    stopTicker();
    isRunning = false;
    endsAt = null;
    remainingMs = durationMs;
    saveTimer();
    renderTimer();
    document.body.dataset.focus = 'false';
    showToast('Timer reset. Start again when you are ready.');
  }
  function skipSession() {
    const nextMode = nextModeAfter(mode);
    setMode(nextMode);
    showToast(`${TIMER_MODES[nextMode].label.toLowerCase()} selected.`);
  }
  function nextModeAfter(completedMode) {
    if (completedMode === 'focus') return stats.totalFocusSessions > 0 && stats.totalFocusSessions % 4 === 0 ? 'long' : 'short';
    return 'focus';
  }
  function startTicker() {
    if (tickerId) return;
    tickerId = window.setInterval(tick, 200);
    tick();
  }
  function stopTicker() {
    if (tickerId) window.clearInterval(tickerId);
    tickerId = null;
  }
  function tick() {
    if (!isRunning || !Number.isFinite(endsAt)) return;
    remainingMs = Math.max(0, endsAt - Date.now());
    if (remainingMs <= 0) {
      finishSession();
      return;
    }
    renderTimer();
    if (Math.ceil(remainingMs / 1000) % 2 === 0) saveTimer();
  }
  function finishSession() {
    const finishedMode = mode;
    stopTicker();
    isRunning = false;
    remainingMs = 0;
    endsAt = null;
    if (finishedMode === 'focus') recordFocusSession();
    playNotification();
    const nextMode = nextModeAfter(finishedMode);
    const shouldAutoStart = finishedMode === 'focus' ? settings.autoBreaks : settings.autoFocus;
    mode = nextMode;
    durationMs = getModeDuration(nextMode);
    remainingMs = durationMs;
    isRunning = Boolean(shouldAutoStart);
    endsAt = isRunning ? Date.now() + remainingMs : null;
    document.body.dataset.focus = isRunning && nextMode === 'focus' ? 'true' : 'false';
    saveTimer();
    renderAll();
    showToast(finishedMode === 'focus' ? 'Focus session complete. Nice work.' : 'Break complete. Ready for another round?');
    if (isRunning) startTicker();
  }
  function recordFocusSession() {
    const today = localDateKey();
    const gap = stats.lastStudyDate ? daysBetween(stats.lastStudyDate, today) : Infinity;
    if (gap === 0) {
      // Keep the current streak unchanged for additional sessions today.
    } else if (gap === 1) {
      stats.currentStreak = Math.max(1, Number(stats.currentStreak) || 0) + 1;
    } else {
      stats.currentStreak = 1;
    }
    stats.lastStudyDate = today;
    if (stats.daily.date !== today) stats.daily = { date: today, focusMinutes: 0, sessions: 0 };
    const completedMinutes = Math.round(durationMs / 60_000);
    stats.totalFocusSessions += 1;
    stats.totalFocusMinutes += completedMinutes;
    stats.daily.focusMinutes += completedMinutes;
    stats.daily.sessions += 1;
    saveStats();
    quoteIndex = (quoteIndex + 1) % APP_CONFIG.quotes.length;
    updateQuotes();
  }

  function renderTimer() {
    const totalSeconds = Math.ceil(durationMs / 1000);
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    els.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    els.timerModeLabel.textContent = TIMER_MODES[mode].label;
    els.timerDurationLabel.textContent = `${Math.round(durationMs / 60_000)} ${TIMER_MODES[mode].bottom}`;
    els.timerState.textContent = isRunning ? (mode === 'focus' ? 'YOU ARE IN THE ZONE' : 'TAKE A BREATH') : (remainingMs === durationMs ? 'READY WHEN YOU ARE' : 'SESSION PAUSED');
    els.timerBottomStatus.textContent = isRunning ? 'SESSION IN PROGRESS' : remainingMs === durationMs ? 'READY TO BEGIN' : 'PAUSED · PICK UP WHEN READY';
    els.timerCardBottom.classList.toggle('is-running', isRunning);
    els.timerRingWrap.classList.toggle('is-running', isRunning);
    const fractionRemaining = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
    els.ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    els.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fractionRemaining));
    els.start.disabled = isRunning;
    els.pause.disabled = !isRunning;
    els.modeButtons.forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const nextSessionNumber = (stats.totalFocusSessions % 4) + 1;
    els.sessionCount.innerHTML = `SESSION ${String(nextSessionNumber).padStart(2, '0')} <i></i>`;
    document.title = isRunning ? `${els.timerDisplay.textContent} · ${TIMER_MODES[mode].label} — Stillroom` : `Stillroom — Focus by ${APP_CONFIG.personalName}`;
    renderCycle();
  }

  function renderCycle() {
    const progress = stats.totalFocusSessions % 4;
    const nextNumber = progress + 1;
    els.cycleNumber.textContent = `${String(nextNumber).padStart(2, '0')} / 04`;
    $$('.cycle-dot', els.cycleDots).forEach((dot, index) => dot.classList.toggle('active', index < progress || (mode === 'focus' && index === progress)));
    if (mode === 'long') els.cycleCaption.textContent = 'A longer reset. Let your mind wander.';
    else if (mode === 'short') els.cycleCaption.textContent = 'Step away for a moment. You earned it.';
    else if (progress === 3) els.cycleCaption.textContent = 'One more focus session until a long break.';
    else els.cycleCaption.textContent = `${progress} of 4 focus sessions completed in this cycle.`;
  }

  function renderStats() {
    els.streak.textContent = String(getCurrentStreak());
    els.sessions.textContent = String(stats.totalFocusSessions);
    els.focusTime.textContent = formatMinutes(stats.totalFocusMinutes);
    els.goal.textContent = String(settings.dailyGoal);
    els.dailyMinutes.textContent = String(stats.daily.focusMinutes);
    els.dailyGoalText.textContent = String(settings.dailyGoal);
    const percent = settings.dailyGoal > 0 ? Math.min(100, Math.round((stats.daily.focusMinutes / settings.dailyGoal) * 100)) : 0;
    els.dailyPercent.textContent = `${percent}% COMPLETE`;
    els.dailyRingPercent.innerHTML = `${percent}<span>%</span>`;
    els.dailyProgressBar.style.width = `${percent}%`;
    els.dailyRingProgress.style.strokeDasharray = String(DAILY_RING_CIRCUMFERENCE);
    els.dailyRingProgress.style.strokeDashoffset = String(DAILY_RING_CIRCUMFERENCE * (1 - percent / 100));
    const remaining = Math.max(0, settings.dailyGoal - stats.daily.focusMinutes);
    els.remainingTime.textContent = remaining === 0 ? 'GOAL REACHED' : `${remaining} MIN LEFT`;
    els.dailySessions.textContent = `${stats.daily.sessions} ${stats.daily.sessions === 1 ? 'SESSION' : 'SESSIONS'} COMPLETED`;
    els.dailyGoalStatus.textContent = percent >= 100 ? 'GOAL COMPLETE ✓' : percent >= 50 ? 'HALFWAY THERE' : 'KEEP BUILDING';
    els.dailyMessage.textContent = percent >= 100 ? 'You showed up for yourself today. Let that be enough.' : stats.daily.focusMinutes > 0 ? 'Every focused minute moves you forward.' : 'Your next focused minute is a fresh start.';
  }
  function formatMinutes(totalMinutes) {
    const minutes = Math.max(0, Math.floor(Number(totalMinutes) || 0));
    return `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`;
  }
  function updateDateLabel() {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short' }).format(now).toUpperCase();
    els.todayDate.textContent = `TODAY / ${formatted}`;
  }
  function checkCalendarRollover() {
    const today = localDateKey();
    if (today === knownDateKey) return;
    knownDateKey = today;
    normalizeDailyStats();
    updateDateLabel();
    renderStats();
  }
  function startDailyRolloverWatcher() {
    if (dailyRolloverId) window.clearInterval(dailyRolloverId);
    dailyRolloverId = window.setInterval(checkCalendarRollover, 60_000);
  }
  function renderAll() { renderTimer(); renderStats(); renderCycle(); }

  function applySettingsToInputs() {
    els.focusDuration.value = settings.durations.focus;
    els.shortDuration.value = settings.durations.short;
    els.longDuration.value = settings.durations.long;
    els.dailyGoalInput.value = settings.dailyGoal;
    els.notificationSound.checked = Boolean(settings.notificationSound);
    els.autoBreaks.checked = Boolean(settings.autoBreaks);
    els.autoFocus.checked = Boolean(settings.autoFocus);
    els.darkMode.checked = Boolean(settings.darkMode);
  }
  function applyTheme() {
    document.documentElement.dataset.theme = settings.darkMode ? 'dark' : 'light';
    const metaTheme = $('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = settings.darkMode ? '#080808' : '#ececec';
  }
  function readNumber(input, min, max, fallback) {
    const value = Number.parseInt(input.value, 10);
    return Number.isFinite(value) ? clamp(value, min, max) : fallback;
  }
  function saveSettingsFromInputs(changedDurationKey = null) {
    settings.durations.focus = readNumber(els.focusDuration, 1, 180, defaultSettings.durations.focus);
    settings.durations.short = readNumber(els.shortDuration, 1, 60, defaultSettings.durations.short);
    settings.durations.long = readNumber(els.longDuration, 1, 90, defaultSettings.durations.long);
    settings.dailyGoal = readNumber(els.dailyGoalInput, 1, 1440, defaultSettings.dailyGoal);
    settings.notificationSound = els.notificationSound.checked;
    settings.autoBreaks = els.autoBreaks.checked;
    settings.autoFocus = els.autoFocus.checked;
    settings.darkMode = els.darkMode.checked;
    applySettingsToInputs();
    applyTheme();
    saveSettings();
    if (changedDurationKey === TIMER_MODES[mode].durationKey && !isRunning) {
      durationMs = getModeDuration(mode);
      remainingMs = durationMs;
      endsAt = null;
      saveTimer();
      renderTimer();
    }
    renderStats();
    els.settingsSaveNote.innerHTML = 'SETTINGS SAVED <span>✓</span>';
    window.setTimeout(() => { els.settingsSaveNote.innerHTML = 'SETTINGS SAVE AUTOMATICALLY <span>✓</span>'; }, 1500);
  }

  function updateQuotes() {
    if (!APP_CONFIG.quotes.length) return;
    els.heroQuote.textContent = APP_CONFIG.quotes[quoteIndex % APP_CONFIG.quotes.length];
    els.timerQuote.textContent = APP_CONFIG.quotes[(quoteIndex + 2) % APP_CONFIG.quotes.length];
    els.closingQuote.textContent = APP_CONFIG.quotes[(quoteIndex + 4) % APP_CONFIG.quotes.length];
  }
  function startQuoteRotation() {
    if (APP_CONFIG.quotes.length < 2) return;
    quoteTimerId = window.setInterval(() => {
      quoteIndex = (quoteIndex + 1) % APP_CONFIG.quotes.length;
      updateQuotes();
    }, 30_000);
  }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(toastTimerId);
    toastTimerId = window.setTimeout(() => els.toast.classList.remove('show'), 2800);
  }

  function playNotification() {
    if (!settings.notificationSound) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.setValueAtTime(880, context.currentTime + .18);
      gain.gain.setValueAtTime(.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.12, context.currentTime + .035);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .62);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + .65);
      oscillator.onended = () => context.close().catch(() => {});
    } catch (error) { console.warn('Notification tone could not play.', error); }
  }

  // Built-in lo-fi sound engine. Audio is created only after the user presses Play.
  function createAmbientEngine() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio API is not supported in this browser.');
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = musicVolume / 100 * 0.11;
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = .82;
    masterGain.connect(analyser);
    analyser.connect(audioContext.destination);

    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1050;
    lowpass.Q.value = .45;
    lowpass.connect(masterGain);

    voiceOscillators = [];
    for (let index = 0; index < 4; index += 1) {
      const oscillator = audioContext.createOscillator();
      const voiceGain = audioContext.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = 110 + index * 35;
      voiceGain.gain.value = index === 0 ? .42 : .18;
      oscillator.connect(voiceGain);
      voiceGain.connect(lowpass);
      oscillator.start();
      voiceOscillators.push(oscillator);
    }

    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 4200;
    noiseGain = audioContext.createGain();
    noiseGain.gain.value = .012;
    const bufferLength = audioContext.sampleRate * 3;
    musicNoiseBuffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const noiseData = musicNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferLength; i += 1) noiseData[i] = (Math.random() * 2 - 1) * .32;
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = musicNoiseBuffer;
    noiseSource.loop = true;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSource.start();

    ambientReady = true;
    applyMusicPreset();
    chordTimerId = window.setInterval(advanceChord, 5000);
  }
  function applyMusicPreset() {
    if (!audioContext || !voiceOscillators.length) return;
    const track = APP_CONFIG.musicTracks[musicIndex];
    const chord = track.chords[0];
    voiceOscillators.forEach((oscillator, index) => oscillator.frequency.setTargetAtTime(chord[index] || chord[0] * (index + 1), audioContext.currentTime, .65));
    if (noiseGain) noiseGain.gain.setTargetAtTime(track.noise, audioContext.currentTime, .7);
    if (masterGain) masterGain.gain.setTargetAtTime(musicVolume / 100 * .11, audioContext.currentTime, .2);
  }
  let chordIndex = 0;
  function advanceChord() {
    if (!audioContext || !ambientReady) return;
    const track = APP_CONFIG.musicTracks[musicIndex];
    chordIndex = (chordIndex + 1) % track.chords.length;
    const chord = track.chords[chordIndex];
    voiceOscillators.forEach((oscillator, index) => oscillator.frequency.setTargetAtTime(chord[index] || chord[0] * (index + 1), audioContext.currentTime, 1.1));
  }
  async function toggleMusic() {
    try {
      if (!ambientReady) createAmbientEngine();
      if (musicIsPlaying) {
        await audioContext.suspend();
        musicIsPlaying = false;
      } else {
        await audioContext.resume();
        musicIsPlaying = true;
      }
      renderMusicUI();
      saveMusicState();
    } catch (error) {
      showToast(error.message || 'Audio could not be started in this browser.');
      console.warn('Ambient audio error:', error);
    }
  }
  function changeTrack(direction) {
    musicIndex = (musicIndex + direction + APP_CONFIG.musicTracks.length) % APP_CONFIG.musicTracks.length;
    chordIndex = 0;
    if (ambientReady) applyMusicPreset();
    renderMusicUI();
    saveMusicState();
  }
  function renderMusicUI() {
    const track = APP_CONFIG.musicTracks[musicIndex];
    els.trackTitle.textContent = track.title;
    els.trackSubtitle.textContent = track.subtitle;
    els.musicPlay.classList.toggle('is-playing', musicIsPlaying);
    els.musicPlay.setAttribute('aria-label', musicIsPlaying ? 'Pause ambient music' : 'Play ambient music');
    $('.music-play-icon', els.musicPlay).textContent = musicIsPlaying ? '' : '▶';
    els.visualizer.classList.toggle('is-playing', musicIsPlaying);
    els.record.classList.toggle('playing', musicIsPlaying);
    els.musicHint.textContent = 'Built-in ambient sound · starts only when you press play';
    els.volume.value = String(musicVolume);
    els.volumeLabel.textContent = `VOLUME ${musicVolume}%`;
  }
  function updateMusicVolume() {
    musicVolume = Number(els.volume.value);
    if (masterGain && audioContext) masterGain.gain.setTargetAtTime(musicVolume / 100 * .11, audioContext.currentTime, .08);
    els.volumeLabel.textContent = `VOLUME ${musicVolume}%`;
    saveMusicState();
  }
  function saveMusicState() { saveObject(STORAGE.music, { volume: musicVolume, track: musicIndex }); }
  function animateVisualizer() {
    if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId);
    const bars = $$('i', els.visualizer);
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const draw = () => {
      if (!musicIsPlaying) { bars.forEach(bar => { bar.style.height = '4px'; }); visualizerFrameId = null; return; }
      if (analyser && data) {
        analyser.getByteFrequencyData(data);
        bars.forEach((bar, index) => {
          const value = data[Math.min(data.length - 1, index * 2)] || 0;
          bar.style.height = `${Math.max(3, 3 + value / 255 * 14)}px`;
        });
      }
      visualizerFrameId = requestAnimationFrame(draw);
    };
    visualizerFrameId = requestAnimationFrame(draw);
  }

  function bindEvents() {
    els.heroStart.addEventListener('click', () => {
      setMode('focus'); startTimer(); $('#timer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    els.start.addEventListener('click', startTimer);
    els.pause.addEventListener('click', pauseTimer);
    els.reset.addEventListener('click', resetTimer);
    els.skip.addEventListener('click', skipSession);
    els.modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));

    [
      [els.focusDuration, 'focus'], [els.shortDuration, 'short'], [els.longDuration, 'long']
    ].forEach(([input, key]) => input.addEventListener('change', () => saveSettingsFromInputs(key)));
    els.dailyGoalInput.addEventListener('change', () => saveSettingsFromInputs());
    [els.notificationSound, els.autoBreaks, els.autoFocus, els.darkMode].forEach(input => input.addEventListener('change', () => saveSettingsFromInputs()));

    els.musicPlay.addEventListener('click', toggleMusic);
    els.previousTrack.addEventListener('click', () => changeTrack(-1));
    els.nextTrack.addEventListener('click', () => changeTrack(1));
    els.volume.addEventListener('input', updateMusicVolume);

    els.menuToggle.addEventListener('click', () => {
      const open = els.menuToggle.getAttribute('aria-expanded') !== 'true';
      els.menuToggle.setAttribute('aria-expanded', String(open));
      els.menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      els.nav.classList.toggle('open', open);
    });
    $$('.nav-link').forEach(link => link.addEventListener('click', () => {
      els.nav.classList.remove('open');
      els.menuToggle.setAttribute('aria-expanded', 'false');
      els.menuToggle.setAttribute('aria-label', 'Open navigation');
    }));

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkCalendarRollover();
        if (isRunning) tick();
      }
    });
    window.addEventListener('beforeunload', saveTimer);
    document.addEventListener('keydown', event => {
      const target = event.target;
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName)) return;
      if (event.code === 'Space') { event.preventDefault(); isRunning ? pauseTimer() : startTimer(); }
    });
  }

  function initRevealAnimations() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(item => item.classList.add('visible')); return; }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: .12, rootMargin: '0px 0px -35px 0px' });
    items.forEach(item => observer.observe(item));
  }
  function initNavHighlight() {
    if (!('IntersectionObserver' in window)) return;
    const sections = ['home', 'timer', 'statistics', 'settings'].map(id => document.getElementById(id)).filter(Boolean);
    const links = $$('.nav-link');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) links.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { rootMargin: '-25% 0px -60% 0px', threshold: 0 });
    sections.forEach(section => observer.observe(section));
  }

  renderMusicUI();
  init();
})();
