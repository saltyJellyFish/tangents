// renders.js runs inside the sandboxed UI. This is where the countdown actually lives. It can ONLY reach the OS via window.electronAPI (preload.js)

const widget = document.getElementById('widget');
const ringWrap = document.getElementById('ring-wrap');
const circle = document.getElementById('progress-circle');
const timeLabel = document.getElementById('time-label');
const timeEdit = document.getElementById('time-edit');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');
// task queue elements
const taskInput = document.getElementById('task-input');
const currentTask = document.getElementById('current-task');
const queueToggle = document.getElementById('queue-toggle');
const queuePanel = document.getElementById('queue-panel');
const queueList = document.getElementById('queue-list');
const subtaskChecklist = document.getElementById('subtask-checklist');

const radius = 90;
const circumference = 2 * Math.PI * radius; // total length of the ring's outline

// stroke-dasharray defines the ring as one dash exactly as long as the circle itself, combined with stroke-dashoffset below, reveals only part of the ring 
circle.style.strokeDasharray = circumference;

let totalSeconds = 5 * 60;
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
// toggles the CSS class that drives the play/pause icon morph
function setRunningUI(isRunning) {
  document.body.classList.toggle('is-running', isRunning);
  startPauseBtn.setAttribute('aria-label', isRunning ? 'Pause' : 'Start');
}
// single button does both jobs: click starts if idle, pauses if running
startPauseBtn.onclick = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    setRunningUI(false);
    return;
  }

  setRunningUI(true);
  timerInterval = setInterval(() => {
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      setRunningUI(false);
      window.electronAPI.clearProgress();
      ringWrap.classList.add('complete');
      setTimeout(() => ringWrap.classList.remove('complete'), 3000);
      // session finished -> mark the active task DONE, don't remove it from the queue
      const finished = getActiveTask();
      if (finished) {
        finished.done = true;
        renderQueue();
      }
      return;
    }
    secondsLeft--;
    render();
  }, 1000);
};
resetBtn.onclick = () => {
  clearInterval(timerInterval);
  timerInterval = null;
  setRunningUI(false);
  secondsLeft = totalSeconds;
  render();
  window.electronAPI.clearProgress();
  resetBtn.classList.add('spin');
  setTimeout(() => resetBtn.classList.remove('spin'), 300);
}
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !widget.classList.contains('editing')) {
    e.preventDefault();
    startPauseBtn.click();
  }
});

// shared range check used by both typed edits and scroll adjustments — 1 to 180 minutes
function clampSeconds(secs) {
  return Math.max(60, Math.min(180 * 60, secs));
}

// click-to-edit time accepts "5" (minutes) or "5:30" (mm:ss)
function parseTimeInput(str) {
  str = str.trim();
  if (str.includes(':')) {
    const [m, s] = str.split(':').map((n) => parseInt(n, 10) || 0);
    return clampSeconds(m * 60 + s);
  }
  const mins = parseInt(str, 10);
  if (isNaN(mins)) return null;
  return clampSeconds(mins * 60);
}
function enterEdit() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    setRunningUI(false);
  }
  widget.classList.add('editing');
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
  if (e.key === 'Escape') exitEdit(false);
});
timeEdit.addEventListener('blur', () => exitEdit(true));

// scroll over the ring to nudge the duration up/down, one minute per notch.
// deltaY is negative when scrolling up — mapped to +60s so "scroll up" reads as "more time"
ringWrap.addEventListener('wheel', (e) => {
  e.preventDefault(); // stops any default page/zoom scroll behavior from fighting with this
  if (widget.classList.contains('editing')) return; // don't fight with a manual text-edit in progress
  if (timerInterval) { // pause first — same reasoning as click-to-edit, scrolling mid-countdown would be confusing
    clearInterval(timerInterval);
    timerInterval = null;
    setRunningUI(false);
  }
  const delta = e.deltaY < 0 ? 60 : -60;
  totalSeconds = clampSeconds(totalSeconds + delta);
  secondsLeft = totalSeconds;
  render();
  window.electronAPI.clearProgress();
}, { passive: false }); // passive:false is required for preventDefault() to actually work on a wheel event

// Task queue... Flat array of { id, text, subtasks: [{text, done}], done }
// No persistence: lives in memory only
// "active task" is not just queue[0], it's the first task that ISN'T done yet

let queue = [];
let nextTaskId = 1;
let addingSubtaskFor = null;

function getActiveTask() {
  return queue.find((t) => !t.done); // first not-yet-done task, or undefined if everything's checked off
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function taskItemHTML(task, isActive) {
  const subtasksHTML = task.subtasks.length
    ? `<ul class="sub-list">${task.subtasks.map((s) => `<li>${escapeHtml(s.text)}</li>`).join('')}</ul>`
    : '';
  const addingHTML = addingSubtaskFor === task.id
    ? `<input class="sub-input" data-task-id="${task.id}" placeholder="Sub-step…" />`
    : '';
  // "done" for the strikethrough in CSS 
  return `
    <li data-task-id="${task.id}" class="${isActive ? 'active' : ''} ${task.done ? 'done' : ''}">
      <div class="task-row">
        <input type="checkbox" class="task-check" aria-label="Mark task done" ${task.done ? 'checked' : ''} />
        <span class="task-text">${escapeHtml(task.text)}</span>
        <button class="add-sub-btn" aria-label="Add sub-step" title="Add sub-step">+</button>
      </div>
      ${subtasksHTML}
      ${addingHTML}
    </li>`;
}

function renderQueue() {
  const activeTask = getActiveTask();
  queueList.innerHTML = queue.map((t) => taskItemHTML(t, t === activeTask)).join('');

  // current-task-row is only shown at all when there IS an active task, otherwise it's not in the layout
  widget.classList.toggle('has-active-task', !!activeTask);
  currentTask.textContent = activeTask ? activeTask.text : '';

  if (activeTask && activeTask.subtasks.length) {
    subtaskChecklist.style.display = 'block';
    subtaskChecklist.innerHTML = activeTask.subtasks
      .map((s, i) => `
        <li>
          <label>
            <input type="checkbox" class="mini-check" data-sub-index="${i}" ${s.done ? 'checked' : ''} />
            <span class="${s.done ? 'done' : ''}">${escapeHtml(s.text)}</span>
          </label>
        </li>`)
      .join('');
  } else {
    subtaskChecklist.style.display = 'none';
    subtaskChecklist.innerHTML = '';
  }

  const pendingInput = queueList.querySelector('.sub-input');
  if (pendingInput) pendingInput.focus();
}

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && taskInput.value.trim()) {
    queue.push({ id: nextTaskId++, text: taskInput.value.trim(), subtasks: [], done: false });
    taskInput.value = '';
    renderQueue();
  }
});

// opening/closing the panel now also tells main.js to grow/shrink the actual window
function toggleQueuePanel() {
  const open = widget.classList.toggle('queue-open');
  queueToggle.setAttribute('aria-expanded', String(open));
  currentTask.setAttribute('aria-expanded', String(open));
  window.electronAPI.resizeForTasks(open);
}
queueToggle.addEventListener('click', toggleQueuePanel);
currentTask.addEventListener('click', toggleQueuePanel);
currentTask.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') toggleQueuePanel();
});

queueList.addEventListener('change', (e) => {
  if (e.target.matches('.task-check')) {
    const li = e.target.closest('li[data-task-id]');
    const id = Number(li.dataset.taskId);
    const task = queue.find((t) => t.id === id);
    if (task) task.done = e.target.checked;
    renderQueue();
  }
});
queueList.addEventListener('click', (e) => {
  if (e.target.matches('.add-sub-btn')) {
    const li = e.target.closest('li[data-task-id]');
    addingSubtaskFor = Number(li.dataset.taskId);
    renderQueue();
  }
});
queueList.addEventListener('keydown', (e) => {
  if (!e.target.matches('.sub-input')) return;
  if (e.key === 'Enter') {
    const taskId = Number(e.target.dataset.taskId);
    const text = e.target.value.trim();
    const task = queue.find((t) => t.id === taskId);
    if (task && text) task.subtasks.push({ text, done: false });
    addingSubtaskFor = null;
    renderQueue();
  }
  if (e.key === 'Escape') {
    addingSubtaskFor = null;
    renderQueue();
  }
});

// uses getActiveTask() instead of queue[0], so this still targets the right task even once earlier tasks in the array have been marked done and left in place
subtaskChecklist.addEventListener('change', (e) => {
  if (!e.target.matches('.mini-check')) return;
  const idx = Number(e.target.dataset.subIndex);
  const active = getActiveTask();
  if (active && active.subtasks[idx]) {
    active.subtasks[idx].done = e.target.checked;
    renderQueue();
  }
});

render();
renderQueue();