// renderer.js runs inside the sandboxed UI. This is where the countdown actually lives. It can ONLY reach the OS via window.electronAPI (see preload.js) it has no direct Node or filesystem access, by design.

const circle = document.getElementById('progress-circle');
const timeLabel = document.getElementById('time-label');

const radius = 90; // must match the SVG circle's r="90" in index.html
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

  if (percentLeft > 0.5) circle.style.stroke = '#a8cbb5';       // green: plenty of time
  else if (percentLeft > 0.2) circle.style.stroke = '#dfd094';  // yellow: getting close
  else circle.style.stroke = '#f87171';                         // red: almost out

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  timeLabel.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Push the same percentage to the main process every tick so the Windows
  // taskbar icon drains in sync with the on-screen ring.
  window.electronAPI.updateProgress(percentLeft);
}

document.getElementById('start-btn').onclick = () => {
  if (timerInterval) return; //prevents stacking multiple intervals if Start is clicked repeatedly
  timerInterval = setInterval(() => {
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      window.electronAPI.clearProgress(); // remove the taskbar bar — session's over
      // Phase 2 hook: "session complete" reward moment fires
      return;
    }
    secondsLeft--;
    render();
  }, 1000); // tick once per second
};

document.getElementById('pause-btn').onclick = () => {
  clearInterval(timerInterval); // stops ticking but keeps secondsLeft where it is
  timerInterval = null;
};

document.getElementById('reset-btn').onclick = () => {
  clearInterval(timerInterval);
  timerInterval = null;
  secondsLeft = totalSeconds; // back to the full 5:00
  render();
  window.electronAPI.clearProgress();
};


render(); 