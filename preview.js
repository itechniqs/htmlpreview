/* ============================================
   HTML Viewer — Preview Engine
   itechniqs.github.io/htmlviewer
   ============================================ */

(function () {
  'use strict';

  // --- DOM References ---
  const previewForm   = document.getElementById('previewForm');
  const urlInput      = document.getElementById('urlInput');
  const previewBtn    = document.getElementById('previewBtn');
  const heroSection   = document.getElementById('heroSection');
  const previewArea   = document.getElementById('previewArea');
  const previewIframe = document.getElementById('previewIframe');
  const iframeContainer = document.getElementById('iframeContainer');
  const loadingOverlay  = document.getElementById('loadingOverlay');
  const previewUrlDisplay = document.getElementById('previewUrlDisplay');
  const copyLinkBtn   = document.getElementById('copyLinkBtn');
  const newTabBtn      = document.getElementById('newTabBtn');
  const closePreviewBtn = document.getElementById('closePreviewBtn');
  const toastContainer  = document.getElementById('toastContainer');
  const recentSection   = document.getElementById('recentSection');
  const recentList      = document.getElementById('recentList');

  const STORAGE_KEY = 'htmlviewer_recent';
  const MAX_RECENT  = 5;

  let currentRawUrl = '';
  let currentGithubUrl = '';

  // --- CORS Proxy Fallback Chain ---
  const PROXIES = [
    '',  // try direct first
    'https://api.codetabs.com/v1/proxy/?quest=',
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ];

  // --- URL Conversion ---
  function githubToRaw(url) {
    // https://github.com/user/repo/blob/branch/path → https://raw.githubusercontent.com/user/repo/branch/path
    return url
      .replace(/\/\/github\.com/, '//raw.githubusercontent.com')
      .replace(/\/blob\//, '/');
  }

  function bitbucketToRaw(url) {
    // https://bitbucket.org/user/repo/src/branch/path → https://bitbucket.org/user/repo/raw/branch/path
    return url.replace(/\/src\//, '/raw/');
  }

  function toRawUrl(url) {
    url = url.trim();
    if (url.includes('github.com')) {
      return githubToRaw(url);
    } else if (url.includes('bitbucket.org')) {
      return bitbucketToRaw(url);
    }
    return url; // Already a raw or other URL
  }

  function isValidUrl(str) {
    try {
      const u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // --- Fetch with Proxy Fallback ---
  function fetchWithProxy(url, proxyIndex = 0) {
    if (proxyIndex >= PROXIES.length) {
      return Promise.reject(new Error('All proxies failed for: ' + url));
    }
    const proxyUrl = PROXIES[proxyIndex] + url;
    return fetch(proxyUrl)
      .then(function (res) {
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        return res.text();
      })
      .catch(function () {
        return fetchWithProxy(url, proxyIndex + 1);
      });
  }

  // --- Rewrite asset URLs in HTML ---
  function rewriteHtml(html, baseUrl) {
    // Compute base directory from the raw URL
    const baseParts = baseUrl.split('/');
    baseParts.pop();
    const baseDir = baseParts.join('/') + '/';

    // Inject a <base> tag so relative URLs resolve correctly
    html = html.replace(/<head([^>]*)>/i, '<head$1><base href="' + baseDir + '">');

    return html;
  }

  // --- Load Preview ---
  function loadPreview(githubUrl) {
    const rawUrl = toRawUrl(githubUrl);
    currentRawUrl = rawUrl;
    currentGithubUrl = githubUrl;

    // Show loading
    showLoading(true);
    showPreviewArea(true);
    previewBtn.classList.add('loading');
    previewBtn.disabled = true;

    fetchWithProxy(rawUrl)
      .then(function (html) {
        html = rewriteHtml(html, rawUrl);

        // Use srcdoc to load into sandboxed iframe
        previewIframe.srcdoc = html;
        previewIframe.onload = function () {
          showLoading(false);
        };

        // Update URL display
        previewUrlDisplay.textContent = githubUrl;

        // Update browser URL
        const shareUrl = location.origin + location.pathname + '?' + githubUrl;
        history.replaceState(null, '', shareUrl);

        // Save to recent
        saveRecent(githubUrl);

        showToast('Preview loaded successfully!', 'success');
      })
      .catch(function (err) {
        console.error('Preview error:', err);
        showLoading(false);
        showPreviewArea(false);
        showToast('Failed to load preview. Check the URL and try again.', 'error');
      })
      .finally(function () {
        previewBtn.classList.remove('loading');
        previewBtn.disabled = false;
      });
  }

  // --- UI Helpers ---
  function showPreviewArea(show) {
    if (show) {
      previewArea.classList.add('active');
      heroSection.classList.add('collapsed');
    } else {
      previewArea.classList.remove('active');
      heroSection.classList.remove('collapsed');
      previewIframe.srcdoc = '';
      currentRawUrl = '';
      currentGithubUrl = '';
      previewUrlDisplay.textContent = '';
      history.replaceState(null, '', location.pathname);
    }
  }

  function showLoading(show) {
    if (show) {
      loadingOverlay.classList.add('active');
    } else {
      loadingOverlay.classList.remove('active');
    }
  }

  // --- Toast Notifications ---
  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;

    const iconSvg = type === 'error'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>';

    toast.innerHTML = '<span class="toast-icon">' + iconSvg + '</span><span>' + escapeHtml(message) + '</span>';
    toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, 4000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Recent URLs (localStorage) ---
  function getRecent() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveRecent(url) {
    let list = getRecent().filter(function (u) { return u !== url; });
    list.unshift(url);
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    renderRecent();
  }

  function removeRecent(url) {
    const list = getRecent().filter(function (u) { return u !== url; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    renderRecent();
  }

  function renderRecent() {
    const list = getRecent();
    if (list.length === 0) {
      recentSection.style.display = 'none';
      return;
    }
    recentSection.style.display = 'block';
    recentList.innerHTML = '';

    list.forEach(function (url) {
      const item = document.createElement('div');
      item.className = 'recent-item';
      item.innerHTML =
        '<span class="recent-item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>' +
        '<span class="recent-item-url">' + escapeHtml(url) + '</span>' +
        '<button class="recent-item-remove" title="Remove">&times;</button>';

      item.querySelector('.recent-item-url').addEventListener('click', function () {
        urlInput.value = url;
        loadPreview(url);
      });

      item.querySelector('.recent-item-remove').addEventListener('click', function (e) {
        e.stopPropagation();
        removeRecent(url);
      });

      recentList.appendChild(item);
    });
  }

  // --- Device Switcher ---
  document.querySelectorAll('.device-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.device-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      iframeContainer.dataset.device = btn.dataset.device;
    });
  });

  // --- Copy Link ---
  copyLinkBtn.addEventListener('click', function () {
    if (!currentGithubUrl) return;
    const shareUrl = location.origin + location.pathname + '?' + currentGithubUrl;
    navigator.clipboard.writeText(shareUrl).then(function () {
      copyLinkBtn.classList.add('copied');
      copyLinkBtn.querySelector('span').textContent = 'Copied!';
      setTimeout(function () {
        copyLinkBtn.classList.remove('copied');
        copyLinkBtn.querySelector('span').textContent = 'Copy Link';
      }, 2000);
    }).catch(function () {
      showToast('Failed to copy link', 'error');
    });
  });

  // --- Open Raw in New Tab ---
  newTabBtn.addEventListener('click', function () {
    if (currentRawUrl) {
      window.open(currentRawUrl, '_blank');
    }
  });

  // --- Close Preview ---
  closePreviewBtn.addEventListener('click', function () {
    showPreviewArea(false);
    urlInput.focus();
  });

  // --- Form Submit ---
  previewForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) {
      showToast('Please enter a URL', 'error');
      return;
    }
    if (!isValidUrl(url)) {
      showToast('Please enter a valid URL (https://...)', 'error');
      return;
    }
    loadPreview(url);
  });

  // --- Auto-preview from query string ---
  function checkQueryString() {
    const query = location.search.substring(1);
    if (query && isValidUrl(query)) {
      urlInput.value = query;
      loadPreview(query);
    } else if (query) {
      // Try decoding in case it's encoded
      try {
        const decoded = decodeURIComponent(query);
        if (isValidUrl(decoded)) {
          urlInput.value = decoded;
          loadPreview(decoded);
        }
      } catch {
        // ignore
      }
    }
  }

  // --- Init ---
  renderRecent();
  checkQueryString();

})();
