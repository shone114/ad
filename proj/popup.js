document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const imgInput = document.getElementById('img-input');
  const vidInput = document.getElementById('vid-input');
  const imgDropzone = document.getElementById('img-dropzone');
  const vidDropzone = document.getElementById('vid-dropzone');
  const imgGrid = document.getElementById('img-grid');
  const vidGrid = document.getElementById('vid-grid');
  const imgEmpty = document.getElementById('img-empty');
  const vidEmpty = document.getElementById('vid-empty');
  const imgCount = document.getElementById('img-count');
  const vidCount = document.getElementById('vid-count');
  const resetBtn = document.getElementById('reset-btn');
  const savedLabel = document.getElementById('saved-label');

  // Wire browse buttons (no inline handlers!)
  document.getElementById('img-browse-btn').addEventListener('click', () => imgInput.click());
  document.getElementById('vid-browse-btn').addEventListener('click', () => vidInput.click());

  let customImages = [];
  let customVideos = [];

  // Tab switching
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  function showSaved() {
    savedLabel.classList.add('show');
    setTimeout(() => savedLabel.classList.remove('show'), 1500);
  }

  function loadAssets() {
    chrome.storage.local.get(['customImages', 'customVideos'], (data) => {
      customImages = data.customImages || [];
      customVideos = data.customVideos || [];
      render();
    });
  }

  function saveAssets(cb) {
    chrome.storage.local.set({ customImages, customVideos }, () => {
      showSaved();
      render();
      if (cb) cb();
    });
  }

  function render() {
    renderGrid(imgGrid, imgEmpty, imgCount, customImages, false);
    renderGrid(vidGrid, vidEmpty, vidCount, customVideos, true);
  }

  function renderGrid(grid, empty, badge, assets, isVideo) {
    grid.innerHTML = '';
    badge.textContent = assets.length;

    if (assets.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    assets.forEach((dataUrl, i) => {
      const card = document.createElement('div');
      card.className = 'card';

      const media = isVideo
        ? Object.assign(document.createElement('video'), { src: dataUrl, muted: true, loop: true, playsInline: true })
        : Object.assign(document.createElement('img'), { src: dataUrl, alt: '' });

      if (isVideo) {
        card.addEventListener('mouseenter', () => media.play().catch(() => {}));
        card.addEventListener('mouseleave', () => { media.pause(); media.currentTime = 0; });
      }

      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '✕';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        assets.splice(i, 1);
        saveAssets();
      });

      card.appendChild(media);
      card.appendChild(del);
      grid.appendChild(card);
    });
  }

  function processFiles(files, isVideo) {
    let pending = 0;
    Array.from(files).forEach((file) => {
      const check = isVideo ? file.type.startsWith('video/') : file.type.startsWith('image/');
      if (!check) return;
      pending++;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const arr = isVideo ? customVideos : customImages;
        if (!arr.includes(dataUrl)) arr.push(dataUrl);
        pending--;
        if (pending === 0) saveAssets();
      };
      reader.readAsDataURL(file);
    });
  }

  // File input change listeners
  imgInput.addEventListener('change', (e) => { processFiles(e.target.files, false); imgInput.value = ''; });
  vidInput.addEventListener('change', (e) => { processFiles(e.target.files, true); vidInput.value = ''; });

  // Drag & Drop for image dropzone
  setupDropzone(imgDropzone, false);
  setupDropzone(vidDropzone, true);

  function setupDropzone(dz, isVideo) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('over');
      processFiles(e.dataTransfer.files, isVideo);
    });
  }

  // Reset
  resetBtn.addEventListener('click', () => {
    if (!confirm('Remove all custom assets and restore defaults?')) return;
    customImages = [];
    customVideos = [];
    chrome.storage.local.remove(['customImages', 'customVideos'], () => {
      showSaved();
      render();
    });
  });

  loadAssets();
});
