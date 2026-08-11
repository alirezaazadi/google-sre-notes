(function () {
  "use strict";

  const THEME_KEY = "sre-notes-theme";
  const script = document.currentScript;
  const pageVersion = script?.dataset.summaryVersion || "";
  const counterpart = script?.dataset.counterpart || "";

  function readTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch (_error) {
      return "light";
    }
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_error) {
      // The theme still works for this page when storage is unavailable.
    }
  }

  function createOption(label, version) {
    const isCurrent = pageVersion === version;
    const canNavigate = isCurrent || Boolean(counterpart);
    const option = document.createElement(canNavigate && !isCurrent ? "a" : "span");

    option.className = "site-controls__option";
    option.textContent = label;

    if (isCurrent) {
      option.setAttribute("aria-current", "page");
    } else if (counterpart) {
      option.href = counterpart;
    } else {
      option.setAttribute("aria-disabled", "true");
      option.title = "This chapter is only available in the GPT version";
    }

    return option;
  }

  function renderControls() {
    const controls = document.createElement("aside");
    controls.className = "site-controls";
    controls.setAttribute("aria-label", "Reading preferences");

    if (pageVersion) {
      const versionGroup = document.createElement("div");
      const label = document.createElement("span");

      versionGroup.className = "site-controls__version";
      versionGroup.setAttribute("role", "group");
      versionGroup.setAttribute("aria-label", "Summary version");
      label.className = "site-controls__label";
      label.textContent = "Summary";
      versionGroup.append(label, createOption("GPT", "gpt"), createOption("Claude", "claude"));
      controls.append(versionGroup);
    }

    const themeButton = document.createElement("button");
    const themeIcon = document.createElement("span");
    const themeText = document.createElement("span");

    themeButton.type = "button";
    themeButton.className = "site-controls__theme";
    themeIcon.className = "site-controls__theme-icon";
    themeIcon.setAttribute("aria-hidden", "true");

    function updateThemeButton() {
      const dark = document.documentElement.dataset.theme === "dark";
      themeButton.setAttribute("aria-pressed", String(dark));
      themeButton.title = dark ? "Switch to light mode" : "Switch to dark mode";
      themeIcon.textContent = dark ? "☀" : "☾";
      themeText.textContent = dark ? "Light" : "Dark";
    }

    themeButton.addEventListener("click", function () {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(theme);
      saveTheme(theme);
      updateThemeButton();
    });

    updateThemeButton();
    themeButton.append(themeIcon, themeText);
    controls.append(themeButton);
    document.body.prepend(controls);
  }

  applyTheme(readTheme());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderControls, { once: true });
  } else {
    renderControls();
  }
})();
