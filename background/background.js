chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    settings: {
      columns: 4,
      aspectRatio: 'square',
      theme: 'dark',
      showNSFW: false
    },
    savedPosts: [],
    followedSubs: [],
    followedUsers: []
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename || 'reddit_media'
    });
  }
  
  if (request.action === 'getSettings') {
    chrome.storage.local.get(['settings'], (result) => {
      sendResponse(result.settings);
    });
    return true;
  }
  
  if (request.action === 'saveSettings') {
    chrome.storage.local.set({ settings: request.settings });
  }
  
  if (request.action === 'getSavedPosts') {
    chrome.storage.local.get(['savedPosts'], (result) => {
      sendResponse(result.savedPosts || []);
    });
    return true;
  }
  
  if (request.action === 'savePost') {
    chrome.storage.local.get(['savedPosts'], (result) => {
      const posts = result.savedPosts || [];
      if (!posts.find(p => p.id === request.post.id)) {
        posts.push(request.post);
        chrome.storage.local.set({ savedPosts: posts });
      }
    });
  }
  
  if (request.action === 'removePost') {
    chrome.storage.local.get(['savedPosts'], (result) => {
      const posts = (result.savedPosts || []).filter(p => p.id !== request.postId);
      chrome.storage.local.set({ savedPosts: posts });
    });
  }
  
  if (request.action === 'getFollowed') {
    chrome.storage.local.get(['followedSubs', 'followedUsers'], (result) => {
      sendResponse({
        subs: result.followedSubs || [],
        users: result.followedUsers || []
      });
    });
    return true;
  }
  
  if (request.action === 'followSub') {
    chrome.storage.local.get(['followedSubs'], (result) => {
      const subs = result.followedSubs || [];
      if (!subs.includes(request.sub)) {
        subs.push(request.sub);
        chrome.storage.local.set({ followedSubs: subs });
      }
    });
  }
  
  if (request.action === 'unfollowSub') {
    chrome.storage.local.get(['followedSubs'], (result) => {
      const subs = (result.followedSubs || []).filter(s => s !== request.sub);
      chrome.storage.local.set({ followedSubs: subs });
    });
  }
  
  if (request.action === 'followUser') {
    chrome.storage.local.get(['followedUsers'], (result) => {
      const users = result.followedUsers || [];
      if (!users.includes(request.user)) {
        users.push(request.user);
        chrome.storage.local.set({ followedUsers: users });
      }
    });
  }
  
  if (request.action === 'unfollowUser') {
    chrome.storage.local.get(['followedUsers'], (result) => {
      const users = (result.followedUsers || []).filter(u => u !== request.user);
      chrome.storage.local.set({ followedUsers: users });
    });
  }
});
