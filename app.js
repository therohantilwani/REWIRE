import { createClient } from '@supabase/supabase-js';

// Onboarding Questions
const QUESTIONS = [
  "I scroll my phone within 5 minutes of waking up.",
  "Things I used to enjoy (reading, hobbies) now feel boring or flat.",
  "I find it difficult to sit for 10 minutes without looking at a screen.",
  "I check my phone notifications multiple times an hour even when it hasn't buzzed.",
  "I watch videos at 1.5x/2x speed or frequently skip forward to get to the point.",
  "I feel anxious, restless, or empty when my phone is left in another room.",
  "I always consume background media (podcasts, music, video) while doing chores or walking.",
  "I struggle to read more than 5 pages of a book without losing focus or feeling the urge to switch tasks."
];

// Habits Definition per Week
const HABITS = {
  1: [
    { id: "h1_no_shortform", text: "No short-form content (reels/shorts/stories)" },
    { id: "h1_screenless_meal", text: "Eat one meal entirely screen-free" },
    { id: "h1_boredom", text: "20 minutes of intentional boredom (no screens/books/inputs)" }
  ],
  2: [
    { id: "h2_deep_focus", text: "10–20 minutes of deep focus or reading a book" },
    { id: "h2_uncomfortable", text: "Try one uncomfortable thing (e.g. cold shower, difficult chore)" },
    { id: "h2_outreach", text: "Reach out to someone you haven't talked to in a while" }
  ],
  3: [
    { id: "h3_sleep_phone", text: "7–8 hours of sleep with phone outside the bedroom" },
    { id: "h3_movement", text: "10 minutes of physical movement (stretch/walk/workout)" },
    { id: "h3_conversation", text: "Have one face-to-face conversation" }
  ]
};

// Weekly Themes info
const THEMES = {
  1: { title: "Subtract", desc: "Eliminating core high-stimulation triggers." },
  2: { title: "Rewire", desc: "Introducing active focus and micro-discomfort." },
  3: { title: "Foundation", desc: "Establishing long-term physiological anchors." }
};

// SUPABASE CONFIGURATION
// Create a free project on https://supabase.com/ to get your credentials.
const SUPABASE_URL = "https://mlfzqqusaxgmbfqdrfoh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9zsAHiAbWB7jPLmjjUks6g_F59ys9M6";

const isSupabaseConfigured = SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!isSupabaseConfigured) {
  console.warn("REWIRE: Supabase credentials are not configured. Running in local mock mode (data persists in localStorage).");
}

// Global App State
let state = {
  user: null, // Holds auth session info
  onboardingAnswers: [],
  onboardingScore: null,
  startDate: null,
  checks: {}, // dateString -> [habitIds]
  notes: {}, // dateString -> noteString
  journal: [], // array of objects { id, date, text, tag, timestamp }
  reassessmentAnswers: null,
  reassessmentScore: null,
  devDayOffset: 0
};

// LocalStorage Keys for Mock Mode fallback
const STORAGE_KEY = "rewire_mock_state";

// Safe Analytics Tracking (Google Analytics + PostHog)
function trackEvent(eventName, properties = {}) {
  console.log(`[Analytics Log] Event: ${eventName}`, properties);
  
  // Track via Google Analytics (gtag.js)
  if (typeof gtag === 'function') {
    gtag('event', eventName, properties);
  }
  
  // Track via PostHog Product Analytics
  if (window.posthog && typeof window.posthog.capture === 'function') {
    window.posthog.capture(eventName, properties);
  }
}

// State Load & Clean Helpers
function loadMockState() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      state = { ...state, ...JSON.parse(data) };
    } catch (e) {
      console.error("Error parsing localStorage mock state", e);
    }
  }
}

function saveMockState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearLocalState() {
  state.onboardingAnswers = [];
  state.onboardingScore = null;
  state.startDate = null;
  state.checks = {};
  state.notes = {};
  state.journal = [];
  state.reassessmentAnswers = null;
  state.reassessmentScore = null;
  state.devDayOffset = 0;
}

// Database Operations
async function loadUserData() {
  if (!state.user) return;
  
  if (supabase) {
    try {
      // 1. Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('starting_score, start_date')
        .maybeSingle();
      
      if (profile) {
        state.onboardingScore = profile.starting_score;
        state.startDate = profile.start_date;
      } else {
        state.onboardingScore = null;
        state.startDate = null;
      }

      // 2. Fetch Habit Checks
      const { data: checks } = await supabase
        .from('habit_checks')
        .select('check_date, habit_id');
      
      state.checks = {};
      if (checks) {
        checks.forEach(c => {
          if (!state.checks[c.check_date]) state.checks[c.check_date] = [];
          state.checks[c.check_date].push(c.habit_id);
        });
      }

      // 3. Fetch Daily Notes
      const { data: notes } = await supabase
        .from('daily_notes')
        .select('note_date, note_text');
      
      state.notes = {};
      if (notes) {
        notes.forEach(n => {
          state.notes[n.note_date] = n.note_text;
        });
      }

      // 4. Fetch Journal Entries
      const { data: journal } = await supabase
        .from('journal_entries')
        .select('id, entry_date, entry_text, entry_tag, entry_timestamp');
      
      state.journal = [];
      if (journal) {
        state.journal = journal.map(j => ({
          id: j.id,
          date: j.entry_date,
          text: j.entry_text,
          tag: j.entry_tag,
          timestamp: parseInt(j.entry_timestamp)
        }));
      }

      // 5. Fetch Reassessment
      const { data: reassess } = await supabase
        .from('reassessment')
        .select('score')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (reassess && reassess.length > 0) {
        state.reassessmentScore = reassess[0].score;
      } else {
        state.reassessmentScore = null;
      }
    } catch (err) {
      console.error("Failed to load user data from Supabase", err);
    }
  } else {
    // Local mock mode load
    loadMockState();
  }
}

// Date Formatting Utilities
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getSimulatedDate() {
  if (!state.startDate) return new Date();
  const date = new Date(state.startDate + 'T00:00:00');
  date.setDate(date.getDate() + state.devDayOffset);
  return date;
}

function getDayNumberForDate(dateStr) {
  if (!state.startDate) return 1;
  const start = new Date(state.startDate + 'T00:00:00').getTime();
  const target = new Date(dateStr + 'T00:00:00').getTime();
  const diffMs = target - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

function getSimulatedDayNumber() {
  return state.devDayOffset + 1;
}

function getWeekNumber(dayNum) {
  if (dayNum <= 7) return 1;
  if (dayNum <= 14) return 2;
  return 3;
}

// Controls Screen Routing Views
function syncAppView() {
  const screenLogin = document.getElementById("screen-login");
  const screenOnboarding = document.getElementById("screen-onboarding");
  const screenMainApp = document.getElementById("screen-main-app");

  if (!state.user) {
    // Unauthenticated -> Show login
    screenLogin.classList.add("active");
    screenOnboarding.classList.remove("active");
    screenMainApp.classList.remove("active");
  } else if (!state.startDate) {
    // Authenticated, no start date -> Onboarding flow
    screenLogin.classList.remove("active");
    screenOnboarding.classList.add("active");
    screenMainApp.classList.remove("active");
  } else {
    // Authenticated & set up -> Main Dashboard
    screenLogin.classList.remove("active");
    screenOnboarding.classList.remove("active");
    screenMainApp.classList.add("active");
    renderActiveView();
  }
}

// Auth Actions
async function signInWithGoogle() {
  trackEvent('auth_click', { provider: 'google' });
  if (supabase) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) alert("OAuth Login failed: " + error.message);
  } else {
    // Mock login in browser preview
    state.user = { id: "mock-user-id", email: "mockuser@example.com" };
    trackEvent('login_success_mock');
    await loadUserData();
    syncAppView();
  }
}

async function signOutUser() {
  trackEvent('signout_click');
  if (supabase) {
    await supabase.auth.signOut();
  } else {
    state.user = null;
    clearLocalState();
    saveMockState();
    syncAppView();
  }
}

// Onboarding Questionnaire
function initOnboarding() {
  const qList = document.getElementById("questions-list");
  qList.innerHTML = "";
  
  state.onboardingAnswers = new Array(QUESTIONS.length).fill(null);
  
  QUESTIONS.forEach((q, index) => {
    const item = document.createElement("div");
    item.className = "question-item";
    
    const text = document.createElement("div");
    text.className = "question-text";
    text.textContent = q;
    
    const control = document.createElement("div");
    control.className = "segmented-control";
    
    const yesBtn = document.createElement("button");
    yesBtn.className = "segment-btn";
    yesBtn.textContent = "Yes";
    yesBtn.onclick = () => selectAnswer(index, true, yesBtn, noBtn);
    
    const noBtn = document.createElement("button");
    noBtn.className = "segment-btn";
    noBtn.textContent = "No";
    noBtn.onclick = () => selectAnswer(index, false, yesBtn, noBtn);
    
    control.appendChild(yesBtn);
    control.appendChild(noBtn);
    item.appendChild(text);
    item.appendChild(control);
    qList.appendChild(item);
  });
  
  document.getElementById("btn-submit-assessment").disabled = true;
}

function selectAnswer(index, answer, yesBtn, noBtn) {
  state.onboardingAnswers[index] = answer;
  
  if (answer) {
    yesBtn.classList.add("selected");
    noBtn.classList.remove("selected");
  } else {
    noBtn.classList.add("selected");
    yesBtn.classList.remove("selected");
  }
  
  const allAnswered = state.onboardingAnswers.every(val => val !== null);
  document.getElementById("btn-submit-assessment").disabled = !allAnswered;
}

function calculateOnboardingScore() {
  const score = state.onboardingAnswers.filter(ans => ans === true).length;
  state.onboardingScore = score;
  
  if (!supabase) {
    saveMockState();
  }
  
  trackEvent('onboarding_quiz_finished', { score });
  
  document.getElementById("result-score-num").textContent = score;
  
  const neuroCard = document.getElementById("neuro-explanation-card");
  const normalCard = document.getElementById("normal-explanation-card");
  
  if (score > 4) {
    neuroCard.classList.remove("hidden");
    normalCard.classList.add("hidden");
  } else {
    normalCard.classList.remove("hidden");
    neuroCard.classList.add("hidden");
  }
  
  showOnboardingStep("onboarding-results");
}

function showOnboardingStep(stepId) {
  const steps = document.querySelectorAll(".onboarding-step");
  steps.forEach(step => {
    if (step.id === stepId) {
      step.classList.add("active");
    } else {
      step.classList.remove("active");
    }
  });
}

// Routing Tab Controller
// Helper to update all day badges (mobile & sidebar desktop)
function updateDayBadges(dayNum) {
  const weekNum = getWeekNumber(dayNum);
  const badgeIds = ["current-day-badge", "sidebar-day-badge"];
  badgeIds.forEach(id => {
    const badge = document.getElementById(id);
    if (badge) {
      badge.className = `badge-week${Math.min(weekNum, 3)}`;
      badge.textContent = dayNum <= 21 ? `Day ${dayNum} of 21` : `Day ${dayNum} (Complete)`;
    }
  });
}

// Routing Tab Controller
function setupTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.onclick = () => {
      const targetView = tab.getAttribute("data-view");
      
      // Keep mobile bottom nav and desktop sidebar synced
      tabs.forEach(t => {
        if (t.getAttribute("data-view") === targetView) {
          t.classList.add("active");
        } else {
          t.classList.remove("active");
        }
      });
      
      const views = document.querySelectorAll(".app-view");
      views.forEach(v => {
        if (v.id === targetView) {
          v.classList.add("active");
        } else {
          v.classList.remove("active");
        }
      });
      
      trackEvent('tab_view', { view: targetView });
      renderActiveView();
    };
  });
}

function renderActiveView() {
  const activeTab = document.querySelector(".nav-tab.active");
  if (!activeTab) return;
  
  const viewId = activeTab.getAttribute("data-view");
  if (viewId === "view-daily") {
    renderDailyView();
  } else if (viewId === "view-progress") {
    renderProgressView();
  } else if (viewId === "view-journal") {
    renderJournalView();
  }
}

// Daily Tracker Renderer
function renderDailyView() {
  const simDay = getSimulatedDayNumber();
  const weekNum = getWeekNumber(simDay);
  const currentTheme = THEMES[weekNum] || { title: "Complete", desc: "Maintain your habit baseline." };
  
  updateDayBadges(simDay);
  
  document.getElementById("weekly-theme-title").textContent = currentTheme.title;
  document.getElementById("weekly-theme-desc").textContent = currentTheme.desc;
  
  const habitsListContainer = document.getElementById("habits-checkbox-list");
  habitsListContainer.innerHTML = "";
  
  const todayStr = formatDate(getSimulatedDate());
  const checkedHabits = state.checks[todayStr] || [];
  const activeHabits = HABITS[weekNum] || [];
  
  if (activeHabits.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.textContent = "All weeks completed. Maintain structural screen boundaries.";
    placeholder.style.color = "var(--text-muted)";
    placeholder.style.fontSize = "0.9rem";
    habitsListContainer.appendChild(placeholder);
  } else {
    activeHabits.forEach(habit => {
      const row = document.createElement("div");
      row.className = "habit-row";
      const isChecked = checkedHabits.includes(habit.id);
      if (isChecked) {
        row.classList.add("checked");
      }
      
      const checkWrapper = document.createElement("div");
      checkWrapper.className = "habit-checkbox-wrapper";
      checkWrapper.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-svg">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      
      const label = document.createElement("span");
      label.className = "habit-label";
      label.textContent = habit.text;
      
      row.appendChild(checkWrapper);
      row.appendChild(label);
      
      row.onclick = () => toggleHabit(habit.id, todayStr);
      habitsListContainer.appendChild(row);
    });
  }
  
  const noteInput = document.getElementById("input-daily-note");
  noteInput.value = state.notes[todayStr] || "";
  
  renderStreak();
}

async function toggleHabit(habitId, dateStr) {
  if (!state.checks[dateStr]) {
    state.checks[dateStr] = [];
  }
  
  const index = state.checks[dateStr].indexOf(habitId);
  const isChecking = index === -1;
  
  if (isChecking) {
    state.checks[dateStr].push(habitId);
    trackEvent('habit_check', { habitId, dateStr });
    
    if (supabase && state.user) {
      await supabase
        .from('habit_checks')
        .insert({
          user_id: state.user.id,
          check_date: dateStr,
          habit_id: habitId
        });
    }
  } else {
    state.checks[dateStr].splice(index, 1);
    trackEvent('habit_uncheck', { habitId, dateStr });
    
    if (supabase && state.user) {
      await supabase
        .from('habit_checks')
        .delete()
        .match({
          user_id: state.user.id,
          check_date: dateStr,
          habit_id: habitId
        });
    }
  }
  
  if (!supabase) {
    saveMockState();
  }
  
  renderDailyView();
}

// Last 7 Days circles
function renderStreak() {
  const container = document.getElementById("streak-circles-container");
  container.innerHTML = "";
  
  const today = getSimulatedDate();
  
  for (let i = 6; i >= 0; i--) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = formatDate(checkDate);
    const hasChecks = state.checks[dateStr] && state.checks[dateStr].length > 0;
    
    const wrapper = document.createElement("div");
    wrapper.className = "streak-dot-wrapper";
    
    const dot = document.createElement("div");
    dot.className = "streak-dot";
    if (hasChecks) dot.classList.add("completed");
    if (i === 0) dot.classList.add("today");
    
    const dayLabel = document.createElement("span");
    dayLabel.className = "streak-day-label";
    const daysName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayLabel.textContent = i === 0 ? "Today" : daysName[checkDate.getDay()];
    
    wrapper.appendChild(dot);
    wrapper.appendChild(dayLabel);
    container.appendChild(wrapper);
  }
}

// Progress Dashboard Renderer
function renderProgressView() {
  const simDay = getSimulatedDayNumber();
  
  const grid = document.getElementById("progress-grid-map");
  grid.innerHTML = "";
  
  const baseStartDate = new Date(state.startDate + 'T00:00:00');
  
  for (let d = 1; d <= 21; d++) {
    const cellDate = new Date(baseStartDate);
    cellDate.setDate(baseStartDate.getDate() + (d - 1));
    const cellDateStr = formatDate(cellDate);
    const hasChecks = state.checks[cellDateStr] && state.checks[cellDateStr].length > 0;
    
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    cell.textContent = d;
    
    if (hasChecks) cell.classList.add("completed");
    if (d === simDay) {
      cell.classList.add("current");
    } else if (d > simDay) {
      cell.classList.add("future");
    }
    
    grid.appendChild(cell);
  }
  
  document.getElementById("stat-days-in").textContent = Math.min(simDay, 21);
  document.getElementById("stat-current-streak").textContent = calculateStreak();
  
  const todayStr = formatDate(getSimulatedDate());
  const checksTodayCount = state.checks[todayStr] ? state.checks[todayStr].length : 0;
  const activeWeek = getWeekNumber(simDay);
  const totalHabitsInWeek = (HABITS[activeWeek] || []).length;
  document.getElementById("stat-habits-checked").textContent = `${checksTodayCount}/${totalHabitsInWeek || 3}`;
  document.getElementById("stat-starting-score").textContent = `${state.onboardingScore}/8`;
  
  // Reassessment trigger logic
  const reScoreContainer = document.getElementById("re-score-container");
  const comparisonCard = document.getElementById("re-score-comparison");
  
  if (simDay >= 21) {
    if (state.reassessmentScore !== null) {
      reScoreContainer.classList.add("locked");
      comparisonCard.classList.remove("hidden");
      
      document.getElementById("compare-start-val").textContent = `${state.onboardingScore}/8`;
      document.getElementById("compare-end-val").textContent = `${state.reassessmentScore}/8`;
      
      const analysis = document.getElementById("comparison-analysis");
      if (state.reassessmentScore < state.onboardingScore) {
        analysis.textContent = `Progress detected. Your baseline score dropped from ${state.onboardingScore} to ${state.reassessmentScore}. Your dopamine receptors have successfully recovered sensitivity. Reading and focus should now feel noticeably more natural.`;
      } else {
        analysis.textContent = `Baseline remains stable at ${state.reassessmentScore}/8. Self-discipline boundaries (no screens at meals, sleeping phone-free) should be integrated long-term to lock in the focus gains.`;
      }
    } else {
      reScoreContainer.classList.remove("locked");
      comparisonCard.classList.add("hidden");
    }
  } else {
    reScoreContainer.classList.add("locked");
    comparisonCard.classList.add("hidden");
  }
}

function calculateStreak() {
  let streak = 0;
  let checkDate = new Date(getSimulatedDate());
  
  const todayStr = formatDate(checkDate);
  const todayHasChecks = state.checks[todayStr] && state.checks[todayStr].length > 0;
  
  if (!todayHasChecks) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  while (true) {
    const dateStr = formatDate(checkDate);
    const targetMs = new Date(dateStr + 'T00:00:00').getTime();
    const startMs = new Date(state.startDate + 'T00:00:00').getTime();
    if (targetMs < startMs) break;
    
    if (state.checks[dateStr] && state.checks[dateStr].length > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Advisor Engine (No toxic positivity)
const ADVISOR_QUOTES = {
  w1_early: [
    "Subtraction triggers acute boredom loops. This is not emptiness, but receptor adjustment. Notice the reflex to grab your device; override it.",
    "Days 1-3 are marked by strong automatic muscle memory. The motor cortex will steer your hand toward your pockets. Stay conscious.",
    "Your brain is expecting an immediate burst of content and getting quietness instead. This friction is where recalibration begins."
  ],
  w1_late: [
    "Day {day}. The ambient neural static is beginning to drop. Focus on the taste of screen-free food. Notice how attention settles when inputs stop.",
    "You are {day} days in. Boredom is not a void; it is the baseline where cognitive energy replenishes. Sit with it.",
    "Melatopsin and dopamine adaptation can make things feel flat. Accept the flatness. It means the baseline is shifting downward."
  ],
  w2_early: [
    "Entering 'Rewire'. Reading books requires linear focus—a track that has been atrophied by non-linear web scanning. Expect reading friction. Push past it.",
    "Day {day}. Micro-discomfort calibrates your baseline. By trying something uncomfortable, you train your brain that focus does not require instant gratification.",
    "Voluntary attention is a muscle. Scrolling is passive. Today, actively guide your attention, even if it feels heavy."
  ],
  w2_late: [
    "You have maintained a {streak}-day streak. The craving loop is weakening as self-directed pathways stabilize.",
    "Day {day}. Physical, face-to-face dialogue provides grounded oxytocin. This is the physiological opposite of shallow online notification rewards.",
    "Focus on sentence structures when reading. If your eyes scan without reading, slow down the pace."
  ],
  w3_early: [
    "Transitioning to 'Foundation'. Keeping the phone out of your bedroom reduces salivary cortisol spikes in the morning. Let your waking thoughts belong to you.",
    "Day {day}. Move without headphones or input. Let your physical systems establish a quiet baseline.",
    "Removing blue light before sleep is the single highest-leverage boundary to recover deep phase melatonin release."
  ],
  w3_late: [
    "Day {day}. High-bandwidth human interaction is critical for a healthy nervous system. Your baseline is ready for real connection.",
    "You are approaching the end of the 21 days. Notice what feels different in your daily presence compared to Day 1.",
    "A {streak}-day streak reflects structural changes. These habits are no longer constraints—they are path-of-least-resistance baselines."
  ],
  completed: [
    "Protocol complete. Your baseline sensitivity is reset. You now possess the conscious agency to choose when to engage. Never scroll in bed.",
    "Re-sensitization is an active practice. The 21-day block is the start. The future is about clean, intentional boundaries."
  ],
  struggled: [
    "An unchecked box is just diagnostics. Track the environmental triggers that preceded the slide. Did boredom trigger anxiety? Adjust your surroundings.",
    "Friction is non-linear. If you checked zero habits today, acknowledge it, but do not catastrophize. Continue tomorrow."
  ]
};

function getAdvisorMessage() {
  const day = getSimulatedDayNumber();
  const streak = calculateStreak();
  const todayStr = formatDate(getSimulatedDate());
  const checksTodayCount = state.checks[todayStr] ? state.checks[todayStr].length : 0;
  
  if (day > 21) {
    const list = ADVISOR_QUOTES.completed;
    return list[Math.floor(Math.random() * list.length)];
  }
  
  if (day > 1 && checksTodayCount === 0 && Math.random() > 0.4) {
    const list = ADVISOR_QUOTES.struggled;
    return list[Math.floor(Math.random() * list.length)];
  }
  
  let category = "w1_early";
  if (day <= 3) {
    category = "w1_early";
  } else if (day <= 7) {
    category = "w1_late";
  } else if (day <= 10) {
    category = "w2_early";
  } else if (day <= 14) {
    category = "w2_late";
  } else if (day <= 18) {
    category = "w3_early";
  } else {
    category = "w3_late";
  }
  
  const list = ADVISOR_QUOTES[category];
  const template = list[Math.floor(Math.random() * list.length)];
  return template.replace(/{day}/g, day).replace(/{streak}/g, streak);
}

function requestAdvisorCheckin() {
  const btn = document.getElementById("btn-advisor-checkin");
  const txt = document.getElementById("advisor-text");
  
  trackEvent('advisor_checkin_click');
  btn.disabled = true;
  txt.innerHTML = `<span class="loading-dots">Calibrating neurological profile<span>.</span><span>.</span><span>.</span></span>`;
  
  const style = document.createElement("style");
  style.id = "dots-animation-style";
  style.innerHTML = `
    @keyframes blink { 50% { opacity: 0; } }
    .loading-dots span { animation: blink 1.4s infinite both; }
    .loading-dots span:nth-child(2) { animation-delay: .2s; }
    .loading-dots span:nth-child(3) { animation-delay: .4s; }
  `;
  document.head.appendChild(style);
  
  setTimeout(() => {
    const message = getAdvisorMessage();
    txt.textContent = "";
    
    let index = 0;
    function type() {
      if (index < message.length) {
        txt.textContent += message.charAt(index);
        index++;
        setTimeout(type, 18);
      } else {
        btn.disabled = false;
        const styleEl = document.getElementById("dots-animation-style");
        if (styleEl) styleEl.remove();
      }
    }
    type();
  }, 1200);
}

// Journal Screen Renderer
function renderJournalView() {
  document.getElementById("input-journal-text").value = "";
  
  const list = document.getElementById("journal-timeline-list");
  list.innerHTML = "";
  
  const combined = [];
  
  // Daily Notes
  Object.keys(state.notes).forEach(dateStr => {
    const text = state.notes[dateStr];
    if (text && text.trim() !== "") {
      combined.push({
        id: `note_${dateStr}`,
        date: dateStr,
        text: text,
        tag: "note",
        timestamp: new Date(dateStr + 'T12:00:00').getTime()
      });
    }
  });
  
  // Custom Reflections
  state.journal.forEach(entry => {
    combined.push(entry);
  });
  
  combined.sort((a, b) => b.timestamp - a.timestamp);
  
  if (combined.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.style.textAlign = "center";
    placeholder.style.color = "var(--text-muted)";
    placeholder.style.padding = "40px 0";
    placeholder.style.fontSize = "0.9rem";
    placeholder.textContent = "Your reflection timeline is empty. Record a journal entry or daily note.";
    list.appendChild(placeholder);
  } else {
    combined.forEach(item => {
      const card = document.createElement("div");
      card.className = "timeline-item";
      
      const header = document.createElement("div");
      header.className = "timeline-header";
      
      const dateText = document.createElement("span");
      dateText.className = "timeline-date";
      
      const dayNum = getDayNumberForDate(item.date);
      dateText.textContent = `${item.date} • Day ${dayNum}`;
      
      const rightArea = document.createElement("div");
      rightArea.className = "timeline-right";
      
      const badge = document.createElement("span");
      badge.className = `timeline-tag-badge tag-badge-${item.tag}`;
      badge.textContent = item.tag;
      
      rightArea.appendChild(badge);
      
      if (item.tag === "journal") {
        const delBtn = document.createElement("button");
        delBtn.className = "btn-delete-entry";
        delBtn.textContent = "Delete";
        delBtn.onclick = () => deleteJournalEntry(item.id);
        rightArea.appendChild(delBtn);
      }
      
      header.appendChild(dateText);
      header.appendChild(rightArea);
      
      const body = document.createElement("div");
      body.className = "timeline-text";
      body.textContent = item.text;
      
      card.appendChild(header);
      card.appendChild(body);
      list.appendChild(card);
    });
  }
}

async function deleteJournalEntry(id) {
  state.journal = state.journal.filter(entry => entry.id !== id);
  trackEvent('journal_delete', { entryId: id });
  
  if (supabase && state.user) {
    await supabase
      .from('journal_entries')
      .delete()
      .match({ id: id });
  } else {
    saveMockState();
  }
  
  renderJournalView();
}

async function saveJournalEntry() {
  const txt = document.getElementById("input-journal-text").value.trim();
  if (txt === "") return;
  
  const activeTagBtn = document.querySelector(".btn-tag.active");
  const tag = activeTagBtn ? activeTagBtn.getAttribute("data-tag") : "journal";
  const todayStr = formatDate(getSimulatedDate());
  
  const newEntry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `journal_${Date.now()}`,
    date: todayStr,
    text: txt,
    tag: tag,
    timestamp: Date.now()
  };
  
  state.journal.push(newEntry);
  trackEvent('journal_save', { tag, length: txt.length });
  
  if (supabase && state.user) {
    await supabase
      .from('journal_entries')
      .insert({
        id: newEntry.id,
        user_id: state.user.id,
        entry_date: newEntry.date,
        entry_text: newEntry.text,
        entry_tag: newEntry.tag,
        entry_timestamp: newEntry.timestamp
      });
  } else {
    saveMockState();
  }
  
  renderJournalView();
}

// Reassessment quiz modal
function initReassessment() {
  const qList = document.getElementById("reassessment-questions-list");
  qList.innerHTML = "";
  
  state.reassessmentAnswers = new Array(QUESTIONS.length).fill(null);
  
  QUESTIONS.forEach((q, index) => {
    const item = document.createElement("div");
    item.className = "question-item";
    
    const text = document.createElement("div");
    text.className = "question-text";
    text.textContent = q;
    
    const control = document.createElement("div");
    control.className = "segmented-control";
    
    const yesBtn = document.createElement("button");
    yesBtn.className = "segment-btn";
    yesBtn.textContent = "Yes";
    yesBtn.onclick = () => {
      state.reassessmentAnswers[index] = true;
      yesBtn.classList.add("selected");
      noBtn.classList.remove("selected");
      checkReassessmentProgress();
    };
    
    const noBtn = document.createElement("button");
    noBtn.className = "segment-btn";
    noBtn.textContent = "No";
    noBtn.onclick = () => {
      state.reassessmentAnswers[index] = false;
      noBtn.classList.add("selected");
      yesBtn.classList.remove("selected");
      checkReassessmentProgress();
    };
    
    control.appendChild(yesBtn);
    control.appendChild(noBtn);
    item.appendChild(text);
    item.appendChild(control);
    qList.appendChild(item);
  });
  
  document.getElementById("btn-submit-reassessment").disabled = true;
  document.getElementById("modal-reassessment").classList.remove("hidden");
}

function checkReassessmentProgress() {
  const allAnswered = state.reassessmentAnswers.every(val => val !== null);
  document.getElementById("btn-submit-reassessment").disabled = !allAnswered;
}

async function submitReassessment() {
  const score = state.reassessmentAnswers.filter(ans => ans === true).length;
  state.reassessmentScore = score;
  
  trackEvent('reassessment_quiz_finished', { score, delta: state.onboardingScore - score });
  
  if (supabase && state.user) {
    await supabase
      .from('reassessment')
      .insert({
        user_id: state.user.id,
        score: score
      });
  } else {
    saveMockState();
  }
  
  document.getElementById("modal-reassessment").classList.add("hidden");
  renderProgressView();
}

// Global Theme controller
function initTheme() {
  const btns = [
    document.getElementById("btn-theme-toggle"),
    document.getElementById("btn-theme-toggle-sidebar")
  ].filter(Boolean);
  
  const savedTheme = localStorage.getItem("rewire_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  
  btns.forEach(btn => {
    btn.onclick = () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      if (currentTheme === "dark") {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("rewire_theme", "light");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("rewire_theme", "dark");
      }
    };
  });
}

// Sync dev slider state safely
function syncDevSlider() {
  const slider = document.getElementById("dev-day-slider");
  const display = document.getElementById("dev-day-display");
  const currentDay = state.devDayOffset + 1;
  if (slider) slider.value = currentDay;
  if (display) display.textContent = `Day ${currentDay}`;
}

// Developer Testing Panel
function setupDevPanel() {
  const panel = document.getElementById("dev-panel");
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (!isDev) {
    if (panel) panel.remove();
    return;
  }

  const toggle = document.getElementById("dev-panel-toggle");
  const slider = document.getElementById("dev-day-slider");
  const display = document.getElementById("dev-day-display");
  
  toggle.onclick = () => {
    panel.classList.toggle("collapsed");
  };
  
  slider.oninput = (e) => {
    const val = parseInt(e.target.value);
    setDevDay(val);
  };
  
  document.getElementById("dev-warp-w1").onclick = () => setDevDay(1);
  document.getElementById("dev-warp-w2").onclick = () => setDevDay(8);
  document.getElementById("dev-warp-w3").onclick = () => setDevDay(15);
  document.getElementById("dev-warp-end").onclick = () => setDevDay(21);
  
  document.getElementById("dev-reset-all").onclick = async () => {
    if (confirm("Are you sure you want to delete all applications reset logs?")) {
      if (supabase && state.user) {
        // Clear Supabase data
        await Promise.all([
          supabase.from('profiles').delete().match({ id: state.user.id }),
          supabase.from('habit_checks').delete().match({ user_id: state.user.id }),
          supabase.from('daily_notes').delete().match({ user_id: state.user.id }),
          supabase.from('journal_entries').delete().match({ user_id: state.user.id }),
          supabase.from('reassessment').delete().match({ user_id: state.user.id })
        ]);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      location.reload();
    }
  };
}

function setDevDay(dayNum) {
  state.devDayOffset = dayNum - 1;
  
  if (!supabase) {
    saveMockState();
  }
  
  renderActiveView();
  updateDayBadges(dayNum);
  syncDevSlider();
}

// Autosave handler for quick daily note
let noteSaveTimeout = null;
function setupNoteAutosave() {
  const input = document.getElementById("input-daily-note");
  const indicator = document.getElementById("note-save-indicator");
  
  input.oninput = () => {
    indicator.textContent = "Saving...";
    indicator.classList.add("saving");
    
    clearTimeout(noteSaveTimeout);
    noteSaveTimeout = setTimeout(async () => {
      const todayStr = formatDate(getSimulatedDate());
      const noteText = input.value;
      state.notes[todayStr] = noteText;
      
      trackEvent('daily_note_autosave', { length: noteText.length });

      if (supabase && state.user) {
        await supabase
          .from('daily_notes')
          .upsert({
            user_id: state.user.id,
            note_date: todayStr,
            note_text: noteText,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,note_date' });
      } else {
        saveMockState();
      }
      
      indicator.textContent = "Saved automatically";
      indicator.classList.remove("saving");
    }, 800);
  };
}

// Page Startup & Auth listener
window.onload = () => {
  initTheme();
  setupTabs();
  setupDevPanel();
  setupNoteAutosave();
  
  // Login click
  document.getElementById("btn-google-login").onclick = signInWithGoogle;
  
  const signoutBtn = document.getElementById("btn-signout");
  if (signoutBtn) signoutBtn.onclick = signOutUser;
  
  const signoutSidebarBtn = document.getElementById("btn-signout-sidebar");
  if (signoutSidebarBtn) signoutSidebarBtn.onclick = signOutUser;
  
  // Check auth state
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        state.user = session.user;
        await loadUserData();
        syncAppView();
        
        // Sync dev slider
        syncDevSlider();
      } else {
        state.user = null;
        clearLocalState();
        syncAppView();
      }
    });
  } else {
    // Mock Mode startup
    // Simulate active session auto-login if was logged in mock
    const wasMockLoggedIn = localStorage.getItem(STORAGE_KEY) !== null;
    if (wasMockLoggedIn) {
      state.user = { id: "mock-user-id", email: "mockuser@example.com" };
      loadUserData().then(() => {
        syncAppView();
        
        syncDevSlider();
      });
    } else {
      syncAppView();
    }
  }
  
  // Onboarding proceed
  document.getElementById("btn-start-assessment").onclick = () => {
    initOnboarding();
    showOnboardingStep("onboarding-assessment");
  };
  
  document.getElementById("btn-submit-assessment").onclick = () => {
    calculateOnboardingScore();
  };
  
  document.getElementById("btn-proceed-date").onclick = () => {
    const dateInput = document.getElementById("input-start-date");
    dateInput.value = formatDate(new Date());
    showOnboardingStep("onboarding-date");
  };
  
  document.getElementById("btn-complete-onboarding").onclick = async () => {
    const dateInput = document.getElementById("input-start-date");
    if (dateInput.value) {
      state.startDate = dateInput.value;
      state.devDayOffset = 0; // Reset to Day 1
      
      trackEvent('reset_protocol_started', { startDate: state.startDate });

      if (supabase && state.user) {
        await supabase
          .from('profiles')
          .insert({
            id: state.user.id,
            starting_score: state.onboardingScore,
            start_date: state.startDate
          });
      } else {
        saveMockState();
      }
      
      syncAppView();
    }
  };
  
  // AI Advisor check-in
  document.getElementById("btn-advisor-checkin").onclick = requestAdvisorCheckin;
  
  // Journal selectors
  const tagBtns = document.querySelectorAll(".btn-tag");
  tagBtns.forEach(btn => {
    btn.onclick = () => {
      tagBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });
  
  document.getElementById("btn-save-journal").onclick = saveJournalEntry;
  
  // Reassessment selectors
  document.getElementById("btn-start-reassessment").onclick = initReassessment;
  document.getElementById("btn-close-modal").onclick = () => {
    document.getElementById("modal-reassessment").classList.add("hidden");
  };
  
  document.getElementById("btn-submit-reassessment").onclick = submitReassessment;
  
  // Reset logs comparison
  document.getElementById("btn-reset-protocol-restart").onclick = async () => {
    if (confirm("Are you sure you want to clear your reset logs and start a new 3-week protocol?")) {
      if (supabase && state.user) {
        await Promise.all([
          supabase.from('profiles').delete().match({ id: state.user.id }),
          supabase.from('habit_checks').delete().match({ user_id: state.user.id }),
          supabase.from('daily_notes').delete().match({ user_id: state.user.id }),
          supabase.from('journal_entries').delete().match({ user_id: state.user.id }),
          supabase.from('reassessment').delete().match({ user_id: state.user.id })
        ]);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      location.reload();
    }
  };
};
