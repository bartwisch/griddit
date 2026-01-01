document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadFollowed();
  await loadSavedPosts();
  setupEventListeners();
});

async function loadSettings() {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
    if (settings) {
      document.getElementById('columns-setting').value = settings.columns;
      document.getElementById('aspect-setting').value = settings.aspectRatio;
      document.getElementById('theme-setting').value = settings.theme;
      document.getElementById('nsfw-setting').checked = settings.showNSFW;
    }
  });
}

async function loadFollowed() {
  chrome.runtime.sendMessage({ action: 'getFollowed' }, (data) => {
    const subsContainer = document.getElementById('followed-subs');
    const usersContainer = document.getElementById('followed-users');
    
    if (data.subs && data.subs.length > 0) {
      subsContainer.innerHTML = data.subs.map(sub => `
        <div class="list-item">
          <a href="https://www.reddit.com/r/${sub}" target="_blank">r/${sub}</a>
          <button class="remove-btn" data-type="sub" data-name="${sub}">×</button>
        </div>
      `).join('');
    } else {
      subsContainer.innerHTML = '<div class="list-empty">No followed subreddits</div>';
    }
    
    if (data.users && data.users.length > 0) {
      usersContainer.innerHTML = data.users.map(user => `
        <div class="list-item">
          <a href="https://www.reddit.com/user/${user}" target="_blank">u/${user}</a>
          <button class="remove-btn" data-type="user" data-name="${user}">×</button>
        </div>
      `).join('');
    } else {
      usersContainer.innerHTML = '<div class="list-empty">No followed users</div>';
    }
    
    document.querySelectorAll('.remove-btn[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const name = btn.dataset.name;
        if (type === 'sub') {
          chrome.runtime.sendMessage({ action: 'unfollowSub', sub: name });
        } else {
          chrome.runtime.sendMessage({ action: 'unfollowUser', user: name });
        }
        loadFollowed();
      });
    });
  });
}

async function loadSavedPosts() {
  chrome.runtime.sendMessage({ action: 'getSavedPosts' }, (posts) => {
    const container = document.getElementById('saved-posts');
    
    if (posts && posts.length > 0) {
      container.innerHTML = posts.slice(0, 10).map(post => `
        <div class="list-item">
          <a href="${post.permalink}" target="_blank" title="${post.title}">
            ${truncate(post.title, 30)}
          </a>
          <button class="remove-btn" data-post-id="${post.id}">×</button>
        </div>
      `).join('');
      
      document.querySelectorAll('.remove-btn[data-post-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'removePost', postId: btn.dataset.postId });
          loadSavedPosts();
        });
      });
    } else {
      container.innerHTML = '<div class="list-empty">No saved posts</div>';
    }
  });
}

function setupEventListeners() {
  document.getElementById('go-btn').addEventListener('click', goToSubreddit);
  document.getElementById('quick-go').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') goToSubreddit();
  });
  
  document.getElementById('columns-setting').addEventListener('change', saveSettings);
  document.getElementById('aspect-setting').addEventListener('change', saveSettings);
  document.getElementById('theme-setting').addEventListener('change', saveSettings);
  document.getElementById('nsfw-setting').addEventListener('change', saveSettings);
  
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importData);
}

function goToSubreddit() {
  const input = document.getElementById('quick-go').value.trim();
  if (!input) return;
  
  let url;
  if (input.startsWith('r/')) {
    url = `https://www.reddit.com/${input}`;
  } else if (input.startsWith('u/')) {
    url = `https://www.reddit.com/user/${input.substring(2)}`;
  } else {
    url = `https://www.reddit.com/r/${input}`;
  }
  
  chrome.tabs.create({ url });
}

function saveSettings() {
  const settings = {
    columns: parseInt(document.getElementById('columns-setting').value),
    aspectRatio: document.getElementById('aspect-setting').value,
    theme: document.getElementById('theme-setting').value,
    showNSFW: document.getElementById('nsfw-setting').checked
  };
  
  chrome.runtime.sendMessage({ action: 'saveSettings', settings });
}

function exportData() {
  chrome.storage.local.get(null, (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reddit_gallery_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      chrome.storage.local.set(data, () => {
        loadSettings();
        loadFollowed();
        loadSavedPosts();
        alert('Data imported successfully!');
      });
    } catch (err) {
      alert('Failed to import data. Invalid file format.');
    }
  };
  reader.readAsText(file);
}

function truncate(str, length) {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}
