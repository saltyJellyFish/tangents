//content.js- content script that detects text selection and creates a highlight button (logic that can interact directly with the webpage's DOM)
/*FLOW:
User drags over text    ↓
Mouse is released → "mouseup" event fires    ↓
Get the current text selection    ↓
Check if any text was actually selected    ↓
    ├── No? Remove the floating Highlight button
    ├── Yes?
        Get the selected text's range and position    ↓
        Create and position highlight button above selected text    ↓
        User clicks → "click" event fires    ↓
        (Prevent the click from removing the selection)    ↓
        Call highlightSelection()    ↓
        Remove floating button
*/
document.addEventListener('mouseup', () => { //document represents current page
  const selection = window.getSelection();
  const text = selection.toString().trim(); //trimming removes whitespace from both ends so we don't highlight empty spaces
  if (text.length === 0) {
    removeFloatingButton(); // clicked elsewhere with nothing selected
    return;
  }
  showFloatingButton(selection);
});
function showFloatingButton(selection) {
  removeFloatingButton(); // only ever one on screen at a time
  const range = selection.getRangeAt(0); //get the first range of the selection (there can be multiple ranges if the user holds down Ctrl/Cmd and selects multiple pieces of text)
  const rect = range.getBoundingClientRect(); //getBoundingClientRect() returns the size and position of the selection to place the buton above it. It returns a DOMRect object with properties like top, left, right, bottom, width, and height.

  const highlightBtn = document.createElement('button'); //creates an html button element. same idea as writing <button></button> in html

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"> <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
  highlightBtn.id = 'highlight-btn';
  highlightBtn.innerHTML = svgIcon;
  highlightBtn.style.top = `${window.scrollY + rect.top - 36}px`; //How far from the top of the webpage should the button be?
  highlightBtn.style.left = `${window.scrollX + rect.left}px`;

  highlightBtn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // stops the click from the default action of collapsing the selection before we use it
    highlightSelection(range);
    removeFloatingButton();
  });
  document.body.appendChild(highlightBtn); //document.createElement('button') creates the button, but it doesn't automatically appear on the webpage
}

function removeFloatingButton() {
  const existing = document.getElementById('highlight-btn'); //searches the webpage for element id
  if (existing) existing.remove();
}
function highlightSelection(range) {
  const span = document.createElement('span'); //<span> is an HTML element commonly used to /isolate a portion of text without creating a new line
  span.className = 'qhHighlight'; //creates CSS class
  span.dataset.qhId = crypto.randomUUID(); // unique id so we can find/remove this exact highlight later

  try {//to prevent errors in case of complex selections like text spanning multiple paras, in turn, multiple elements
    range.surroundContents(span); // works for simple, single-element selections
  } catch (err) { //backup
    // complex selection spanning multiple elements — extract and rebuild instead
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }

  span.addEventListener('click', () => removeHighlight(span)); // click an existing highlight to remove it
  saveHighlight(span.textContent, span.dataset.qhId);
}
//When you highlight text, highlightSelection wraps it like this: <p>The quick <span class="qhHighlight">brown fox</span> jumps.</p>
//"brown fox" now lives inside that span — it's the span's child text node. If you just did span.remove(), you'd delete the span and everything inside it
function removeHighlight(span) {//goal is to remove the highlight without losing the text.
  const parent = span.parentNode;
  while (span.firstChild) parent.insertBefore(span.firstChild, span); // unwrap: move children out
  parent.removeChild(span); // remove the now-empty wrapper
  //deleteHighlight(span.dataset.qhId)- Only after the DOM is cleaned up does it tell chrome.storage to forget this highlight, using the UUID that was stamped onto the span back when it was created. This is what makes the removal persistent — without this, reloading the page would call restoreHighlights()
}