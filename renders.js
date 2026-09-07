// renderer.js runs inside the sandboxed UI. This is where the countdown actually lives. It can ONLY reach the OS via window.electronAPI (preload.js)

const widget = document.getElementById('widget');
const ringWrap = document.getElementById('ring-wrap');
const circle = document.getElementById('progress-circle');
const timeLabel = document.getElementById('time-label');
const timeEdit = document.getElementById('time-edit');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');
 
const radius = 90; 
const circumference = 2 * Math.PI * radius; // total length of the ring's outline

// stroke-dasharray defines the ring as one dash exactly as long as the circle itself.
// Combined with stroke-dashoffset below, this lets us "reveal" only part of the ring —
// that's the actual trick behind an SVG circular progress indicator.
circle.style.strokeDasharray = circumference;

let totalSeconds = 5 * 60; // default session length: 5 min
let secondsLeft = totalSeconds;
let timerInterval = null;   // holds the setInterval handle so Pause/Reset can cancel it

function render() {
  const percentLeft = secondsLeft / totalSeconds; 
  // Offsetting the dash by (total length * fraction already elapsed) makes the visible arc shrink as time passes... this IS the "shrinking disk" effect.
  const offset = circumference * (1 - percentLeft);
  circle.style.strokeDashoffset = offset;

  if (percentLeft > 0.5) circle.style.stroke = '#94b7a1e7';       // green: plenty of time
  else if (percentLeft > 0.2) circle.style.stroke = '#dfd094';  // yellow: getting close
  else circle.style.stroke = '#f87171';                         // red: almost out

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  timeLabel.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Push the same percentage to the main process every tick so the Windows taskbar icon drains in sync with the on-screen ring.
  window.electronAPI.updateProgress(percentLeft); 
}
// --- toggles the CSS class that drives the play/pause icon morph ---
function setRunningUI(isRunning) {
  document.body.classList.toggle('is-running', isRunning);
  startPauseBtn.setAttribute('aria-label', isRunning ? 'Pause' : 'Start');
}
 
// --- single button does both jobs now: click starts if idle, pauses if running ---
startPauseBtn.onclick = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    setRunningUI(false);
    return;
  } // already running, ignore extra clicks

  setRunningUI(true);
  timerInterval = setInterval(() => {
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      setRunningUI(false);
      window.electronAPI.clearProgress(); // remove the taskbar bar — session's over, reward moment fires (TBI)
      ringWrap.classList.add('complete');
      setTimeout(() => ringWrap.classList.remove('complete'), 3000); // remove the class after the animation finishes so it can be triggered again next session
      return;
    }
    secondsLeft--;
    render();
  }, 1000); // tick once per second
};
resetBtn.onclick = () => {
  clearInterval(timerInterval);
  timerInterval = null;
  setRunningUI(false);
  secondsLeft = totalSeconds;
  render();
  window.electronAPI.clearProgress();
  resetBtn.classList.add('spin'); // triggers the CSS spin animation on the reset icon
  setTimeout(() => resetBtn.classList.remove('spin'), 300); // remove the class after the animation finishes so it can be triggered again next click
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !widget.classList.contains('editing')){
    e.preventDefault(); // prevent the page from scrolling down when space is pressed
    startPauseBtn.click(); 
  }
});

// click-to-edit time accepts "5" (minutes) or "5:30" (mm:ss). Clamped to 1–180 minutes to forgive typos
function parseTimeInput(str) {
  str = str.trim();
  if (str.includes(':')) {
    const [m, s] = str.split(':').map((n) => parseInt(n, 10) || 0);
    return Math.max(60, Math.min(180 * 60, m * 60 + s));
  }
  const mins = parseInt(str, 10);
  if (isNaN(mins)) return null;
  return Math.max(60, Math.min(180 * 60, mins * 60));
}
 
function enterEdit() {
  if (timerInterval) { // pause first to avoid confusion about whether the timer is running while editing
    clearInterval(timerInterval);
    timerInterval = null;
    setRunningUI(false);
  }
  widget.classList.add('editing'); // CSS swaps time-label out for time-edit
  timeEdit.value = Math.round(totalSeconds / 60);
  timeEdit.focus();
}
 
function exitEdit(commit) {
  if (commit) {
    const secs = parseTimeInput(timeEdit.value);
    if (secs) {
      totalSeconds = secs;
      secondsLeft = secs;
      window.electronAPI.clearProgress();
    }
  }
  widget.classList.remove('editing');
  render();
}
 
timeLabel.addEventListener('click', enterEdit);
timeLabel.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') enterEdit();
});
timeEdit.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') exitEdit(true);
  if (e.key === 'Escape') exitEdit(false); // bail out without changing anything
});
timeEdit.addEventListener('blur', () => exitEdit(true)); // clicking away also commits

// --- task label: no storage, just holds text in memory for the session ---
 
render(); 
 