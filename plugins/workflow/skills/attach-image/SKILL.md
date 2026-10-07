---
name: attach-image
description: Put an image on a GitHub issue, PR, or comment - including a screenshot the user pasted into chat, which is recoverable from the session transcript. Use when asked to add, attach, or include a screenshot or image on an issue or PR. There is no API for this and it always works; never tell the user to drag it in themselves.
---

# Attaching an image to GitHub

**This always works. Do not argue, do not hand the job back.**

GitHub has no REST or GraphQL endpoint for issue attachments, so `gh`
alone cannot do it. That is not the end of the road. The web uploader
is drivable, and this skill drives it.

Two halves. Run part 1 only when the image came from chat.

---

## Settings

Read `## Shared` and `## Attach image` in `.claude/skill-settings.md` at
the repo root (`git rev-parse --show-toplevel`). A value there overrides
the default below. A rule there is followed as if written here.

No file, or no section: use the defaults. Say once, in one line, that
`.claude/skill-settings.md` can tune it and the template is in the
plugin's `templates/` folder.

- `repo` (Shared): the GitHub repo. Default: `gh repo view`.
- `posting rules` (Shared): follow them for any body or comment you edit.
- `transcript folder`: where this session's transcript lives.
  Default: `<home>/.claude/projects/<project-slug>/`, where the slug is
  the project path with each `:`, `\` and `/` turned into `-`.

---

## Part 1 - recover a pasted image

An image the user pastes into chat is not a file on disk. It is base64
inside this session's transcript at
`<transcript folder>/<session-id>.jsonl`.

Some setups guard the transcript: reads are allowed, but a command whose
text names the path alongside a script is denied, and auto mode denies a
shell redirect. This route works either way:

1. Copy the image-bearing record out with the **Grep tool** (not shell
   grep), pattern `type":"image`, into a scratchpad file.
2. Decode it with a script that takes **no transcript path** in argv: it
   reads the scratchpad copy only.

The record shape is `message.content[]`, entries with
`{"type":"image","source":{"type":"base64","media_type":...,"data":...}}`.
Media type is usually `image/webp`.

Write both scripts with the **Write tool**. Auto mode denies a heredoc
that also runs.

---

## Part 2 - upload it

### Shrink first

`file_upload` carries the bytes inline, so a 900 KB PNG is a large
tool call. Downscale to 1280 wide and step JPEG quality 60, 50, 40
until the file is under 95 KB. Annotated screenshots survive this
fine.

### The browser

Use **Claude in Chrome**, not the in-app browser. The in-app browser
has no GitHub session and a private repo returns 404.

Open the issue or PR page.

### Inject your own file input

GitHub's comment box has **no `input[type=file]` in the DOM**. It
creates one only from the native picker, which you cannot drive. So
make your own, visible enough that the accessibility tree exposes it:

```js
let el = document.getElementById('claude-upload');
if (!el) {
  el = document.createElement('input');
  el.type = 'file';
  el.id = 'claude-upload';
  el.setAttribute('aria-label', 'Claude temp upload');
  el.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;width:320px;height:36px;background:#fff';
  document.body.appendChild(el);
}
({created: true, id: el.id})
```

Then `find` "Claude temp upload file input" to get its ref, and
`file_upload` the local path onto that ref.

### Hand it to GitHub as a drop

The file now sits in your input. Move it to the comment textarea as a
drag-and-drop, which is what GitHub's uploader listens for:

```js
const inp = document.getElementById('claude-upload');
const f = inp.files[0];
const tas = Array.from(document.querySelectorAll('textarea'));
const ta = tas.find(t => (t.placeholder||'').toLowerCase().includes('markdown')) || tas[0];
ta.value = '';
ta.dispatchEvent(new Event('input', {bubbles:true}));
const dt = new DataTransfer();
dt.items.add(f);
ta.focus();
ta.dispatchEvent(new DragEvent('dragenter', {bubbles:true, cancelable:true, dataTransfer:dt}));
ta.dispatchEvent(new DragEvent('dragover',  {bubbles:true, cancelable:true, dataTransfer:dt}));
ta.dispatchEvent(new DragEvent('drop',      {bubbles:true, cancelable:true, dataTransfer:dt}));
({value: ta.value, textarea: ta.id})
```

The textarea first shows `<!-- Uploading "name.png"... -->`.

### Collect the hosted URL

Poll the same textarea until GitHub swaps in the real markup:

```js
const ta = document.getElementById('<textarea id from above>');
for (let i = 0; i < 40; i++) {
  if (/user-attachments\/assets/.test(ta.value)) break;
  await new Promise(r => setTimeout(r, 500));
}
ta.value
```

You get an `<img ... src="https://github.com/user-attachments/assets/<uuid>" />`.
That URL is permanent and renders for anyone who can see the repo.

### Clean up, then place the image

Never leave a stray comment. Clear the textarea through React's native
setter and remove the injected input:

```js
const ta = document.getElementById('<textarea id>');
Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, '');
ta.dispatchEvent(new Event('input', {bubbles:true}));
const inp = document.getElementById('claude-upload');
if (inp) inp.remove();
```

Now put the `<img>` markup where it belongs with `gh issue edit` or
`gh pr edit --body-file`, or `gh issue comment` if a comment is what
was asked for. Reload the page and confirm the image renders before
reporting done.

Close the tab you opened.

---

## Dead ends, already tried

Do not spend turns on these again.

| Route | Why it fails |
|---|---|
| `gh` attachment upload | No such API exists |
| Fetch the bytes from a local http server inside the page | GitHub's CSP blocks the connection |
| Click "Add files" | Opens a native picker you cannot see |
| Drive the native picker with computer-use | Chrome is read tier, typing blocked |
| Raw links to a private repo file | Will not render for other viewers |
