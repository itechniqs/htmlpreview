/* ============================================
   HTML Viewer — Preview Engine
   itechniqs.github.io/htmlviewer
   ============================================ */

(function () {
  'use strict';

  // --- DOM References ---
  const previewForm = document.getElementById('previewForm');
  const urlInput = document.getElementById('urlInput');
  const previewBtn = document.getElementById('previewBtn');
  const heroSection = document.getElementById('heroSection');
  const previewArea = document.getElementById('previewArea');
  const previewIframe = document.getElementById('previewIframe');
  const iframeContainer = document.getElementById('iframeContainer');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const previewUrlDisplay = document.getElementById('previewUrlDisplay');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const openInTabBtn = document.getElementById('openInTabBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const closePreviewBtn = document.getElementById('closePreviewBtn');
  const toastContainer = document.getElementById('toastContainer');
  const recentSection = document.getElementById('recentSection');
  const recentList = document.getElementById('recentList');
  const tokenToggleBtn = document.getElementById('tokenToggleBtn');
  const tokenModal = document.getElementById('tokenModal');
  const tokenModalClose = document.getElementById('tokenModalClose');
  const tokenInput = document.getElementById('tokenInput');
  const tokenSaveBtn = document.getElementById('tokenSaveBtn');
  const tokenStatus = document.getElementById('tokenStatus');

  const STORAGE_KEY = 'htmlviewer_recent';
  const TOKEN_KEY = 'htmlviewer_github_token';
  const MAX_RECENT = 5;

  let currentRawUrl = '';
  let currentGithubUrl = '';
  let currentHtml = '';

  // --- CORS Proxy Fallback Chain ---
  const PROXIES = [
    '',  // try direct first
    'https://api.codetabs.com/v1/proxy/?quest=',
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ];

  // --- GitHub Token Management ---
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; }
    catch { return ''; }
  }

  function saveToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    updateTokenUI();
  }

  function updateTokenUI() {
    const hasToken = !!getToken();
    tokenToggleBtn.classList.toggle('has-token', hasToken);
    if (hasToken) {
      tokenInput.value = '';
      tokenInput.placeholder = '••••••••••••••••••••••••';
    } else {
      tokenInput.placeholder = 'ghp_xxxxxxxxxxxxxxxxxxxx';
    }
  }

  // --- URL Parsing ---
  // Parse a GitHub URL into { owner, repo, branch, path }
  function parseGithubUrl(url) {
    // https://github.com/owner/repo/blob/branch/path/to/file.html
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/);
    if (match) {
      return { owner: match[1], repo: match[2], branch: match[3], path: match[4] };
    }
    return null;
  }

  // --- URL Conversion ---
  function githubToRaw(url) {
    return url
      .replace(/\/\/github\.com/, '//raw.githubusercontent.com')
      .replace(/\/blob\//, '/');
  }

  function bitbucketToRaw(url) {
    return url.replace(/\/src\//, '/raw/');
  }

  function toRawUrl(url) {
    url = url.trim();
    if (url.includes('github.com')) {
      return githubToRaw(url);
    } else if (url.includes('bitbucket.org')) {
      return bitbucketToRaw(url);
    }
    return url;
  }

  function isValidUrl(str) {
    try {
      const u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // --- Fetch via GitHub API (for private repos) ---
  function fetchViaGitHubApi(parsed, token) {
    const apiUrl = 'https://api.github.com/repos/' + parsed.owner + '/' + parsed.repo + '/contents/' + parsed.path + '?ref=' + parsed.branch;
    return fetch(apiUrl, {
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3.raw'
      }
    }).then(function (res) {
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      return res.text();
    });
  }

  // --- Fetch with Proxy Fallback (for public repos) ---
  function fetchWithProxy(url, proxyIndex) {
    if (proxyIndex === undefined) proxyIndex = 0;
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

  // --- Smart Fetch: try GitHub API with token first, then fallback ---
  function smartFetch(githubUrl) {
    const token = getToken();
    const parsed = parseGithubUrl(githubUrl);

    if (token && parsed) {
      // Try authenticated GitHub API first (works for private repos)
      return fetchViaGitHubApi(parsed, token)
        .catch(function () {
          // Fallback to raw URL with proxy chain
          return fetchWithProxy(toRawUrl(githubUrl), 0);
        });
    }

    // No token — use raw URL with proxy chain
    return fetchWithProxy(toRawUrl(githubUrl), 0);
  }

  // --- Rewrite asset URLs in HTML ---
  function rewriteHtml(html, baseUrl) {
    var baseParts = baseUrl.split('/');
    baseParts.pop();
    var baseDir = baseParts.join('/') + '/';
    html = html.replace(/<head([^>]*)>/i, '<head$1><base href="' + baseDir + '">');
    return html;
  }

  // --- Load Preview ---
  function loadPreview(githubUrl) {
    var rawUrl = toRawUrl(githubUrl);
    currentRawUrl = rawUrl;
    currentGithubUrl = githubUrl;
    currentHtml = '';

    showLoading(true);
    showPreviewArea(true);
    previewBtn.classList.add('loading');
    previewBtn.disabled = true;

    smartFetch(githubUrl)
      .then(function (html) {
        html = rewriteHtml(html, rawUrl);
        currentHtml = html;

        previewIframe.srcdoc = html;
        previewIframe.onload = function () {
          showLoading(false);
        };

        previewUrlDisplay.textContent = githubUrl;

        var shareUrl = location.origin + location.pathname + '?' + githubUrl;
        history.replaceState(null, '', shareUrl);

        saveRecent(githubUrl);
        showToast('Preview loaded successfully!', 'success');
      })
      .catch(function (err) {
        console.error('Preview error:', err);
        showLoading(false);
        showPreviewArea(false);

        var token = getToken();
        var msg = 'Failed to load preview. ';
        if (!token && parseGithubUrl(githubUrl)) {
          msg += 'For private repos, add a GitHub token (🔒 icon in header).';
        } else {
          msg += 'Check the URL and try again.';
        }
        showToast(msg, 'error');
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
      previewArea.classList.remove('fullscreen');
      heroSection.classList.remove('collapsed');
      previewIframe.srcdoc = '';
      currentRawUrl = '';
      currentGithubUrl = '';
      currentHtml = '';
      previewUrlDisplay.textContent = '';
      history.replaceState(null, '', location.pathname);
    }
  }

  function showLoading(show) {
    loadingOverlay.classList.toggle('active', show);
  }

  // --- Toast Notifications ---
  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;

    var iconSvg = type === 'error'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>';

    toast.innerHTML = '<span class="toast-icon">' + iconSvg + '</span><span>' + escapeHtml(message) + '</span>';
    toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(function () { toast.remove(); }, 300);
    }, 5000);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Recent URLs (localStorage) ---
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function saveRecent(url) {
    var list = getRecent().filter(function (u) { return u !== url; });
    list.unshift(url);
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    renderRecent();
  }

  function removeRecent(url) {
    var list = getRecent().filter(function (u) { return u !== url; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    renderRecent();
  }

  function renderRecent() {
    var list = getRecent();
    if (list.length === 0) {
      recentSection.style.display = 'none';
      return;
    }
    recentSection.style.display = 'block';
    recentList.innerHTML = '';

    list.forEach(function (url) {
      var item = document.createElement('div');
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
    var shareUrl = location.origin + location.pathname + '?' + currentGithubUrl;
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

  // --- Open in New Tab (rendered HTML as blob) ---
  openInTabBtn.addEventListener('click', function () {
    if (!currentHtml) return;
    var blob = new Blob([currentHtml], { type: 'text/html' });
    var blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  });

  // --- Fullscreen Toggle ---
  fullscreenBtn.addEventListener('click', function () {
    previewArea.classList.toggle('fullscreen');
    var isFs = previewArea.classList.contains('fullscreen');
    fullscreenBtn.querySelector('span').textContent = isFs ? 'Exit FS' : 'Fullscreen';
  });

  // --- Close Preview ---
  closePreviewBtn.addEventListener('click', function () {
    showPreviewArea(false);
    urlInput.focus();
  });

  // --- Token Modal ---
  tokenToggleBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    tokenModal.classList.add('active');
    setTimeout(function () { tokenInput.focus(); }, 100);
  });

  tokenModalClose.addEventListener('click', function () {
    tokenModal.classList.remove('active');
  });

  // Close when clicking outside modal content
  tokenModal.addEventListener('click', function (e) {
    if (e.target === tokenModal) {
      tokenModal.classList.remove('active');
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (tokenModal.classList.contains('active')) {
        tokenModal.classList.remove('active');
      }
    }
  });

  // Save / Clear token
  tokenSaveBtn.addEventListener('click', function () {
    var val = tokenInput.value.trim();
    if (val) {
      saveToken(val);
      tokenInput.value = '';
      tokenStatus.textContent = '✓ Token saved securely in your browser.';
      tokenStatus.className = 'token-status saved';
    } else {
      // If input is empty and token exists, clear it
      if (getToken()) {
        saveToken('');
        tokenStatus.textContent = 'Token cleared.';
        tokenStatus.className = 'token-status cleared';
      } else {
        tokenStatus.textContent = 'Please enter a token.';
        tokenStatus.className = 'token-status cleared';
      }
    }
    setTimeout(function () { tokenStatus.textContent = ''; }, 3000);
  });

  // --- Form Submit ---
  previewForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = urlInput.value.trim();
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
    var query = location.search.substring(1);
    if (query && isValidUrl(query)) {
      urlInput.value = query;
      loadPreview(query);
    } else if (query) {
      try {
        var decoded = decodeURIComponent(query);
        if (isValidUrl(decoded)) {
          urlInput.value = decoded;
          loadPreview(decoded);
        }
      } catch {
        // ignore
      }
    }
  }

  // --- Escape key to exit fullscreen ---
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && previewArea.classList.contains('fullscreen')) {
      previewArea.classList.remove('fullscreen');
      fullscreenBtn.querySelector('span').textContent = 'Fullscreen';
    }
  });

  // --- Init ---
  updateTokenUI();
  renderRecent();
  checkQueryString();

})();
