-Git tracks your project using three primary environments:
    1. Working Directory: The actual files you see and edit on your computer.
    2. Staging Area (Index): The "loading dock" where Git prepares changes for the next commit.
    3. Git Repository (History): The permanent record of your committed snapshots.

- System commands !== git commands
==> rm filename deletes file from the computer's hard drive whilegit git rm deletes the file from your computer and immediately stages that deletion 

- The command line is the ONLY place you can run all Git commands, GUI is a subset

-To make Git ignore a folder, you need to add the folder's name to your project's .gitignore file.

-Standard JSON does not allow comments but JSONC is an extension that supports single-line (//) and multi-line (/* */) comments.

-A content script is JavaScript that Chrome runs inside a web page. It sees the page’s DOM and can change it.It runs in an isolated world. That means it has its own JavaScript variables, separate from the page’s scripts. The page can’t read your variables, and you can’t read theirs. But you both share the same DOM.

-The extension service worker runs in the background and handles browser events: a keyboard shortcut, the install event, a message from another context. It has no DOM, no window, no page.

-document.addEventListener() is a built-in JavaScript method used to listen for specific web page events—such as clicks, keystrokes, or content loading—at the document level.
==> DOMContentLoaded- wait for HTML to fully load
==> keyup/keydown- any key press
==> click/ dclclick
==> mouseup/mousedown- mouse pressed/released
==> mouseover/ mouseout- pointer enters or leaves an element's boundaries

-"run_at": "document_idle" waits until page's initial DOM is ready before running script so it doesn't restore highlights prematurely 







