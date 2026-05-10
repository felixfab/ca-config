# AGENTS.md: Project Protocol & Architecture

## 1. Development Mandates (Best Practices V2)
All development on **[PROJECT_NAME]** must strictly adhere to these architectural constraints:

* **UI Isolation:** All UI elements must reside within the **Shadow DOM** (defined in `shared.js`) to prevent host page CSS interference [cite: 2.1].
* **Security & XSS:**
    * Never use `innerHTML` with unsanitized data [cite: 2.1].
    * Mandatory use of `esc()` for text content and `escAttr()` for attributes [cite: 2.1, 2.3].
    * Strictly no `eval()`, `new Function()`, or dynamic `<script>` insertion [cite: 2.1].
* **DOM Management:**
    * Use **Event Delegation** via `data-action` attributes and `e.target.closest()` [cite: 2.1, 2.3].
    * Avoid direct DOM listeners on repeated list items [cite: 2.1].
* **Data Integrity:**
    * The `storage.js` layer must remain "pure" (no DOM dependencies) to ensure testability [cite: 2.1, 2.3].
    * Debounce storage writes and cache references at the module level to optimize performance [cite: 2.1].
* **Namespace Safety:** Every module must be wrapped in an **IIFE** and export via the `window.__ca.*` namespace [cite: 2.1, 2.3].

## 2. File Structure & Responsibilities

```text
src/anchor/
  shared.js     -> Core Utilities: Shadow DOM root, XSS sanitizers, shared state (window.__ca.state) [cite: 2.3].
  storage.js    -> Data Layer: Pure logic for CRUD operations via chrome.storage.local [cite: 2.3].
  panel.js      -> Side Panel: Manages the main UI, list rendering, and bulk actions [cite: 2.3].
  timeline.js   -> Overlays: Handles the timeline UI and contextual filters [cite: 2.3].
  content.js    -> Coordinator: Entry point, event observers, and keyboard shortcuts [cite: 2.3].
  anchor.css    -> Styles: Scoped CSS for the Shadow DOM [cite: 2.3].
  manifest.json -> Configuration: MV3 compliant [cite: 2.3].
```

## 3. Implementation Workflow

### UI Creation Protocol
When creating new UI components, the agent must follow this sequence:
1. **Define CSS:** Add static styles to `anchor.css` using classes [cite: 2.1].
2. **Shadow Entry:** Use `$append()` to attach elements to the Shadow Root [cite: 2.3].
3. **Data Binding:** Use `data-action` for interactive elements to enable delegation in the parent module [cite: 2.1, 2.3].

### Data & Testing Protocol
1. **Storage Update:** Modify `storage.js` for any schema changes [cite: 2.1, 2.3].
2. **Test Verification:** Run `node test/storage.test.js` to ensure the data layer is intact before UI integration [cite: 2.1, 2.3].

## 4. Build & Validation Commands
```bash
# Verify JS Syntax
for f in src/anchor/*.js; do node --check "$f" && echo "$f: OK"; done

# Execute Storage Unit Tests
node test/storage.test.js
```
