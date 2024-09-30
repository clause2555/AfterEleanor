// background.js

// Spotify API Endpoints
const SPOTIFY_AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Replace with your actual Client ID and Redirect URI
const CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID';
const REDIRECT_URI = 'YOUR_REDIRECT_URI'; // e.g., 'http://localhost'
const SCOPES = [
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
];

// Access Token Management
let accessToken = '';
let tokenExpiresAt = 0;

// Initialize the Spotify Web Playback SDK
let player;

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_ACCESS_TOKEN') {
    sendResponse({ accessToken: accessToken });
  } else if (request.type === 'FETCH_PLAYLISTS') {
    fetchUserPlaylists().then(playlists => sendResponse({ playlists })).catch(err => sendResponse({ error: err }));
    return true; // Indicates that the response is asynchronous
  } else if (request.type === 'FETCH_TRACKS') {
    fetchPlaylistTracks(request.playlistId).then(tracks => sendResponse({ tracks })).catch(err => sendResponse({ error: err }));
    return true;
  } else if (request.type === 'SAVE_GROUP') {
    saveGroup(request.playlistId, request.trackIds).then(() => sendResponse({ success: true })).catch(err => sendResponse({ error: err }));
    return true;
  } else if (request.type === 'GET_GROUPS') {
    getGroups(request.playlistId).then(groups => sendResponse({ groups })).catch(err => sendResponse({ error: err }));
    return true;
  } else if (request.type === 'INIT_PLAYER') {
    initializePlayer().then(() => sendResponse({ success: true })).catch(err => sendResponse({ error: err }));
    return true;
  }
});

// Authenticate the user with Spotify
async function authenticate() {
  return new Promise((resolve, reject) => {
    const authURL = `${SPOTIFY_AUTHORIZE_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}&response_type=token&show_dialog=true`;

    chrome.identity.launchWebAuthFlow(
      {
        url: authURL,
        interactive: true,
      },
      (redirectURL) => {
        if (chrome.runtime.lastError || redirectURL.includes('error')) {
          reject(chrome.runtime.lastError || new Error('Authentication failed'));
          return;
        }

        const params = new URLSearchParams(new URL(redirectURL).hash.substring(1));
        accessToken = params.get('access_token');
        const expiresIn = parseInt(params.get('expires_in')); // in seconds
        tokenExpiresAt = Date.now() + expiresIn * 1000;

        resolve(accessToken);
      }
    );
  });
}

// Refresh the access token if expired
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  } else {
    try {
      await authenticate();
      return accessToken;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }
}

// Fetch User Playlists
async function fetchUserPlaylists() {
  const token = await getAccessToken();
  let playlists = [];
  let nextURL = `${SPOTIFY_API_BASE}/me/playlists?limit=50`;

  while (nextURL) {
    const response = await fetch(nextURL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch playlists');
    }

    const data = await response.json();
    playlists = playlists.concat(data.items);
    nextURL = data.next;
  }

  return playlists;
}

// Fetch Tracks from a Playlist
async function fetchPlaylistTracks(playlistId) {
  const token = await getAccessToken();
  let tracks = [];
  let nextURL = `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=100`;

  while (nextURL) {
    const response = await fetch(nextURL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch playlist tracks');
    }

    const data = await response.json();
    tracks = tracks.concat(data.items.map(item => item.track));
    nextURL = data.next;
  }

  return tracks;
}

// Save a Group of Songs
async function saveGroup(playlistId, trackIds) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['groups'], (result) => {
      const groups = result.groups || {};
      if (!groups[playlistId]) {
        groups[playlistId] = [];
      }
      groups[playlistId].push(trackIds);
      chrome.storage.sync.set({ groups }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  });
}

// Get Groups for a Playlist
async function getGroups(playlistId) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['groups'], (result) => {
      const groups = result.groups || {};
      resolve(groups[playlistId] || []);
    });
  });
}

// Initialize the Spotify Web Playback SDK
async function initializePlayer() {
  await loadSpotifySDK();

  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      player = new Spotify.Player({
        name: 'Spotify Group Shuffle Player',
        getOAuthToken: cb => { cb(accessToken); },
      });

      // Error Handling
      player.addListener('initialization_error', ({ message }) => { console.error(message); });
      player.addListener('authentication_error', ({ message }) => { console.error(message); });
      player.addListener('account_error', ({ message }) => { console.error(message); });
      player.addListener('playback_error', ({ message }) => { console.error(message); });

      // Ready
      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        resolve();
      });

      // Not Ready
      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      // Playback State Changed
      player.addListener('player_state_changed', state => {
        if (!state) {
          return;
        }

        const currentTrackId = state.track_window.current_track.id;
        handleQueueAdjustment(currentTrackId);
      });

      // Connect to the player!
      player.connect();
    };
  });
}

// Load Spotify Web Playback SDK
function loadSpotifySDK() {
  return new Promise((resolve, reject) => {
    if (window.Spotify) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Spotify SDK'));
    };
    document.head.appendChild(script);
  });
}

// Handle Queue Adjustment Based on Grouped Songs
/*
async function handleQueueAdjustment(currentTrackId) {
  try {
    const groups = await getAllGroups();
    const matchedGroup = findGroupContainingTrack(groups, currentTrackId);

    if (matchedGroup && matchedGroup[0] === currentTrackId) {
      // Enqueue the rest of the group
      const tracksToEnqueue = matchedGroup.slice(1);
      for (const trackId of tracksToEnqueue) {
        await enqueueTrack(trackId);
      }

      // Notify the user
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon.png',
        title: 'Spotify Group Shuffle',
        message: 'A group of songs has been queued to play in order.',
      });
    }
  } catch (error) {
    console.error('Error adjusting queue:', error);
  }
}
  */

async function handleQueueAdjustment(currentTrackId) {
    chrome.storage.sync.get(['groups'], async (result) => {
      const groups = result.groups || {};
      const playlistId = await getCurrentPlaylistId(); // Implement method to get current playlist
      const playlistGroups = groups[playlistId] || [];
      
      for (const group of playlistGroups) {
        if (group.includes(currentTrackId)) {
          // Find the position of the current track and enqueue the rest
          const groupIndex = group.indexOf(currentTrackId);
          if (groupIndex !== 0) continue; // Only adjust if it's the first in the group
          
          const tracksToEnqueue = group.slice(1);
          for (const trackId of tracksToEnqueue) {
            await enqueueTrack(trackId); // Implement enqueueTrack using Spotify API
          }
          break;
        }
      }
    });
  }
  

// Retrieve All Groups
async function getAllGroups() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['groups'], (result) => {
      const groups = result.groups || {};
      // Flatten all groups into a single array
      const allGroups = [];
      for (const playlistId in groups) {
        groups[playlistId].forEach(group => allGroups.push(group));
      }
      resolve(allGroups);
    });
  });
}

// Find the group that contains the current track
function findGroupContainingTrack(groups, trackId) {
  for (const group of groups) {
    if (group.includes(trackId)) {
      return group;
    }
  }
  return null;
}

// Enqueue a Track using Spotify API
async function enqueueTrack(trackId) {
  const token = await getAccessToken();
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/queue?uri=spotify:track:${trackId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to enqueue track ${trackId}`);
  }
}

// Listen for installation to authenticate
chrome.runtime.onInstalled.addListener(() => {
  authenticate().catch(err => console.error('Failed to authenticate on install:', err));
});
