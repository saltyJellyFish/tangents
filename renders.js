// renderer.js runs inside the sandboxed UI. This is where the countdown actually lives. It can ONLY reach the OS via window.electronAPI (preload.js)

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

// stroke-dasharray defines the ring as one dash exactly as long as the circle itself
// combined with stroke-dashoffset below,reveals only part of the ring that's the actual trick behind an SVG circular progress indicator
circle.style.strokeDasharray = circumference;

let totalSeconds = 5 * 60; // 
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
// toggles the CSS class that drives the play/pause icon morph ---
function setRunningUI(isRunning) {
  document.body.classList.toggle('is-running', isRunning);
  startPauseBtn.setAttribute('aria-label', isRunning ? 'Pause' : 'Start');
}
 
// single button does both jobs now: click starts if idle, pauses if running ---
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

      // session finished -> the task it was tied to is done, advance the queue automatically
      if (queue.length) {
        queue.shift();
        renderQueue();
      }
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

// Task queue... Flat array of { id, text, subtasks: [{text, done}], done }
// No persistence: lives in memory only

let queue = [];        // the actual list of pending tasks, queue[0] is always "current"
let nextTaskId = 1;    // simple incrementing id
let addingSubtaskFor = null; // id of the task currently showing its inline "add sub-step" input, or null

// escapes user-typed text before it goes into innerHTML, so a task named e.g. "<b>" can't break the layout
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// builds the HTML for one <li> in the queue panel
function taskItemHTML(task, isActive) {
  const subtasksHTML = task.subtasks.length
    ? `<ul class="sub-list">${task.subtasks.map((s) => `<li>${escapeHtml(s.text)}</li>`).join('')}</ul>`
    : '';
  const addingHTML = addingSubtaskFor === task.id
    ? `<input class="sub-input" data-task-id="${task.id}" placeholder="Sub-step…" />`
    : '';
  return `
    <li data-task-id="${task.id}" class="${isActive ? 'active' : ''}">
      <div class="task-row">
        <input type="checkbox" class="task-check" aria-label="Mark task done" />
        <span class="task-text">${escapeHtml(task.text)}</span>
        <button class="add-sub-btn" aria-label="Add sub-step" title="Add sub-step">+</button>
      </div>
      ${subtasksHTML}
      ${addingHTML}
    </li>`;
}

// redraws everything that depends on queue stat like the panel list, the current-task line, and the live sub-step checklist for whichever task is at the front of the queue
function renderQueue() {
  queueList.innerHTML = queue.map((t, i) => taskItemHTML(t, i === 0)).join('');

  currentTask.textContent = queue.length ? queue[0].text : 'No task selected';

  const active = queue[0];
  if (active && active.subtasks.length) {
    subtaskChecklist.style.display = 'block';
    subtaskChecklist.innerHTML = active.subtasks
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

  // if a sub-step input was just added to the DOM, focus it so typing works immediately
  const pendingInput = queueList.querySelector('.sub-input');
  if (pendingInput) pendingInput.focus();
}

// add a task: Enter in the ghost input pushes a new task onto the end of the queue
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && taskInput.value.trim()) {
    queue.push({ id: nextTaskId++, text: taskInput.value.trim(), subtasks: [], done: false });
    taskInput.value = '';
    renderQueue();
  }
});

// expand/collapse the full panel
function toggleQueuePanel() {
  const open = widget.classList.toggle('queue-open');
  queueToggle.setAttribute('aria-expanded', String(open));
  currentTask.setAttribute('aria-expanded', String(open));
}
queueToggle.addEventListener('click', toggleQueuePanel);
currentTask.addEventListener('click', toggleQueuePanel);
currentTask.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') toggleQueuePanel(); 
});

// event delegation for everything inside the queue panel, since its <li>s are rebuilt on every render
queueList.addEventListener('change', (e) => {
  if (e.target.matches('.task-check')) {
    // manually checking a task off removes it from the queue immediately, same outcome as a session completing it
    const li = e.target.closest('li[data-task-id]');
    const id = Number(li.dataset.taskId);
    queue = queue.filter((t) => t.id !== id);
    renderQueue();
  }
});
queueList.addEventListener('click', (e) => {
  if (e.target.matches('.add-sub-btn')) {
    const li = e.target.closest('li[data-task-id]');
    addingSubtaskFor = Number(li.dataset.taskId);
    renderQueue(); // re-render injects the inline input and focuses it
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
    addingSubtaskFor = null; // bail out without adding anything
    renderQueue();
  }
});

// the live checklist below the ring: ticking a sub-step off just flips its `done` flag, doesn't remove it 
subtaskChecklist.addEventListener('change', (e) => {
  if (!e.target.matches('.mini-check')) return;
  const idx = Number(e.target.dataset.subIndex);
  const active = queue[0];
  if (active && active.subtasks[idx]) {
    active.subtasks[idx].done = e.target.checked;
    renderQueue();
  }
});

render();
renderQueue(); // initial paint for the (empty) queue state