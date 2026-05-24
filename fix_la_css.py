import re

with open('src/App.css', 'r') as f:
    css = f.read()

start_marker = "  /* ===== Admin Leader Assignment ===== */"
end_marker = "  .lam-stat-card {"

if start_marker in css and end_marker in css:
    start_idx = css.find(start_marker)
    end_idx = css.find("  /* toolbar */", start_idx)
    
    new_css = """  /* ===== Admin Leader Assignment ===== */

  .la-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .la-header h1 {
    font-size: 24px;
    font-weight: 800;
    color: var(--ink);
    margin: 0 0 4px;
  }

  .la-header p {
    font-size: 14px;
    color: var(--muted);
    font-weight: 500;
    margin: 0;
  }

  .la-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .la-header-btn {
    height: 36px;
    padding: 0 16px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--line-2);
    background: var(--surface);
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.15s;
  }
  .la-header-btn:hover { background: var(--tint); }

  .la-badge-red {
    height: 32px;
    padding: 0 14px;
    border-radius: var(--radius-full, 9999px);
    background: var(--status-danger-bg);
    color: var(--status-danger);
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
  }

  .la-header-more {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--line-2);
    background: var(--surface);
    font-size: 18px;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .la-grid {
    display: grid;
    grid-template-columns: 240px 300px 1fr;
    gap: 20px;
    align-items: start;
  }

  .la-col {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg, 12px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .la-col-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--line);
  }

  .la-col-head h2 {
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  .la-col-head-right {
    align-items: center;
  }

  .la-col-head-actions {
    display: flex;
    gap: 6px;
  }

  .la-count-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--status-info);
    background: var(--status-info-bg);
    padding: 2px 8px;
    border-radius: var(--radius-full, 9999px);
  }

  .la-search-wrap {
    position: relative;
    padding: 12px 16px 0;
  }

  .la-col-all {
    max-height: calc(100vh - 240px);
    display: flex;
    flex-direction: column;
  }

  .la-col-all .la-search-wrap {
    padding: 0;
    flex: 1;
  }

  .la-search {
    width: 100%;
    height: 36px;
    padding: 10px 32px 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md, 8px);
    font-size: 14px;
    color: var(--text);
    background: var(--surface);
    box-sizing: border-box;
  }
  .la-search:focus {
    border-color: var(--ink);
    outline: none;
  }

  .la-search-icon {
    position: absolute;
    right: 24px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 13px;
    pointer-events: none;
    color: var(--muted-2);
  }

  .la-col-all .la-search-icon {
    right: 12px;
  }

  .la-leader-list {
    display: flex;
    flex-direction: column;
    padding: 8px 12px;
    max-height: 520px;
    overflow-y: auto;
  }

  .la-leader-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    border: none;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 0.15s;
  }

  .la-leader-row:hover { background: var(--tint); }
  .la-leader-row.active { background: var(--tint); }

  .la-leader-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--paper);
    color: var(--ink);
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .la-leader-row.active .la-leader-avatar {
    background: var(--ink);
    color: #fff;
  }

  .la-leader-name {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }

  .la-leader-count {
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
    white-space: nowrap;
  }

  .la-leader-count.zero { color: var(--status-danger); }

  .la-add-leader-btn {
    margin: 8px 16px 16px;
    height: 36px;
    border-radius: var(--radius-md, 8px);
    border: 1px dashed var(--line-2);
    background: transparent;
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .la-add-leader-btn:hover { background: var(--tint); }

  .la-assigned-list {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    max-height: 580px;
    overflow-y: auto;
  }

  .la-assigned-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }

  .la-assigned-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .la-assigned-info strong { font-size: 15px; font-weight: 700; color: var(--ink); }
  .la-assigned-info span { font-size: 12px; font-weight: 600; color: var(--muted); }
  .la-assigned-info em { font-size: 11px; color: var(--muted-2); font-style: normal; }

  .la-release-btn {
    padding: 10px 16px;
    border-radius: var(--radius-md, 8px);
    border: none;
    background: var(--status-danger);
    color: #FFFFFF;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;
    transition: background 0.15s;
    height: 36px;
  }

  .la-release-btn:hover { opacity: 0.9; }
  .la-release-btn:disabled { opacity: 0.5; cursor: default; }

  .la-select-mode-btn {
    height: 32px;
    padding: 0 12px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--line-2);
    background: var(--surface);
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
  }

  .la-select-mode-btn.active {
    background: var(--tint);
    border-color: var(--ink);
    color: var(--ink);
  }

  .la-select-all-btn {
    height: 32px;
    padding: 0 12px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--line-2);
    background: var(--surface);
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
  }

  .la-selection-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--tint);
    border-bottom: 1px solid var(--line);
    font-size: 14px;
    color: var(--ink);
    font-weight: 700;
  }

  .la-selection-bar button {
    height: 32px;
    padding: 0 12px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--line-2);
    background: var(--surface);
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    cursor: pointer;
  }

  .la-bulk-assign-btn {
    margin-left: auto;
    height: 36px !important;
    padding: 10px 16px !important;
    border-radius: var(--radius-md, 8px) !important;
    border: none !important;
    background: var(--ink) !important;
    color: #fff !important;
    font-size: 14px !important;
    font-weight: 700 !important;
    cursor: pointer;
  }

  .la-bulk-assign-btn:disabled { opacity: .5; cursor: default; }

  .la-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
  }

  .la-filter-select {
    height: 36px;
    padding: 0 28px 0 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md, 8px);
    background: var(--surface);
    font-size: 14px;
    color: var(--text);
    cursor: pointer;
    appearance: auto;
  }

  .la-total-label {
    padding: 12px 16px 4px;
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
    margin: 0;
  }

  .la-card-list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding: 0 16px 16px;
  }

  .la-card-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
    transition: background 0.15s;
    border-radius: 8px;
  }

  .la-card-row:last-child { border-bottom: none; }
  .la-card-row:hover { background: var(--tint); }
  .la-card-row.selected { background: var(--tint); }

  .la-card-check {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    cursor: pointer;
    accent-color: var(--ink);
  }

  .la-card-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .la-card-info strong { font-size: 15px; font-weight: 700; color: var(--ink); }
  .la-card-info span { font-size: 12px; font-weight: 600; color: var(--muted); }

  .la-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .la-assignee-badge {
    font-size: 12px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: var(--radius-full, 9999px);
    background: var(--tint);
    color: var(--muted);
    white-space: nowrap;
  }

  .la-assignee-badge.mine { background: var(--status-warn-bg); color: var(--status-warn); }
  .la-assignee-badge.unassigned { background: var(--tint); color: var(--muted-3); }

  .la-detail-btn {
    height: 36px;
    padding: 10px 16px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--line-2);
    background: var(--surface);
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .la-detail-btn:hover {
    background: var(--tint);
  }

  .la-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 16px;
    border-top: 1px solid var(--line);
  }

  .la-pagination button {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--line-2);
    background: var(--surface);
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .la-pagination button.active {
    background: var(--ink);
    border-color: var(--ink);
    color: #fff;
  }

  .la-pagination button:disabled { opacity: .4; cursor: default; }

  .la-pagination span {
    font-size: 14px;
    color: var(--muted);
    padding: 0 8px;
  }

  .la-empty-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    color: var(--muted);
    font-size: 14px;
    text-align: center;
    line-height: 1.7;
  }

  .la-empty-msg {
    padding: 20px;
    text-align: center;
    color: var(--muted-3);
    font-size: 14px;
  }

  .lam-stat-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg, 12px);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .lam-stat-card strong {
    font-size: 20px;
    font-weight: 800;
    color: var(--ink);
    line-height: 1.2;
  }

  .lam-stat-card span {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }

"""
    updated_css = css[:start_idx] + new_css + css[end_idx:]
    with open('src/App.css', 'w') as f:
        f.write(updated_css)
    print("Successfully replaced la- classes.")
else:
    print("Markers not found.")
