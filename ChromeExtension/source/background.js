// background.js

// Spotify API Endpoints
const SPOTIFY_AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Replace with your actual Client ID
const CLIENT_ID = '';
const REDIRECT_URI = chrome.identity.getRedirectURL(); // Dynamically set Redirect URI
const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing'
];

// Access Token Management
let accessToken = '';
let tokenExpiresAt = 0;

// Current Playing Track ID
let currentTrackId = '';

// Polling Interval (in milliseconds)
const POLLING_INTERVAL = 5000; // 5 seconds
let pollingIntervalId = null;

// Initialize the extension by authenticating and starting the polling
(async function initialize() {
  try {
    await authenticate();
    startPolling();
  } catch (error) {
    console.error('Initialization error:', error);
  }
})();

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);
  
  if (request.type === 'GET_ACCESS_TOKEN') {
    sendResponse({ accessToken: accessToken });
    return true;
  }
  
  if (request.type === 'FETCH_PLAYLISTS') {
    fetchUserPlaylists()
      .then(playlists => {
        console.log('Fetched playlists:', playlists);
        sendResponse({ playlists });
      })
      .catch(err => {
        console.error('Error fetching playlists:', err);
        sendResponse({ error: err.message || err });
      });
    return true; // Indicates that the response is asynchronous
  } else if (request.type === 'FETCH_TRACKS') {
    fetchPlaylistTracks(request.playlistId)
      .then(tracks => {
        console.log('Fetched tracks for playlist:', request.playlistId, tracks);
        sendResponse({ tracks });
      })
      .catch(err => {
        console.error('Error fetching tracks:', err);
        sendResponse({ error: err.message || err });
      });
    return true;
  } else if (request.type === 'SAVE_GROUP') {
    saveGroup(request.playlistId, request.trackIds)
      .then(() => {
        console.log('Saved group for playlist:', request.playlistId);
        sendResponse({ success: true });
      })
      .catch(err => {
        console.error('Error saving group:', err);
        sendResponse({ error: err.message || err });
      });
    return true;
  } else if (request.type === 'GET_GROUPS') {
    getGroups(request.playlistId)
      .then(groups => {
        console.log('Fetched groups for playlist:', request.playlistId, groups);
        sendResponse({ groups });
      })
      .catch(err => {
        console.error('Error fetching groups:', err);
        sendResponse({ error: err.message || err });
      });
    return true;
  }
});

// Function to authenticate the user and obtain an access token
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
          const error = chrome.runtime.lastError || new Error('Authentication failed');
          console.error('Authentication error:', error);
          reject(error);
          return;
        }

        try {
          const params = new URLSearchParams(new URL(redirectURL).hash.substring(1));
          accessToken = params.get('access_token');
          const expiresIn = parseInt(params.get('expires_in')); // in seconds
          tokenExpiresAt = Date.now() + expiresIn * 1000;

          console.log('Authentication successful. Access token obtained.');
          resolve(accessToken);
        } catch (e) {
          console.error('Failed to parse authentication response:', e);
          reject(new Error('Failed to parse authentication response.'));
        }
      }
    );
  });
}

// Function to refresh the access token if expired
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt - 60000) { // Refresh 1 minute before expiry
    return accessToken;
  } else {
    try {
      await authenticate();
      return accessToken;
    } catch (error) {
      console.error('Authentication error:', error.message || error);
      throw error;
    }
  }
}

// Function to start polling the currently playing track
function startPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
  }

  pollingIntervalId = setInterval(async () => {
    try {
      const token = await getAccessToken();
      const currentTrack = await getCurrentPlayingTrack(token);
      
      if (currentTrack && currentTrack.item && currentTrack.item.id) {
        const fetchedTrackId = currentTrack.item.id;

        if (fetchedTrackId !== currentTrackId) {
          console.log('Detected track change:', fetchedTrackId);
          currentTrackId = fetchedTrackId;
          await handleCurrentTrack(fetchedTrackId);
        }
      } else {
        console.log('No track is currently playing.');
      }
    } catch (error) {
      console.error('Error during polling:', error);
    }
  }, POLLING_INTERVAL);

  console.log('Started polling for currently playing track every', POLLING_INTERVAL / 1000, 'seconds.');
}

// Function to fetch the user's currently playing track
async function getCurrentPlayingTrack(token) {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.status === 204) {
    // No content, nothing is playing
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch currently playing track.');
  }

  const data = await response.json();
  return data;
}

// Function to handle the currently playing track
async function handleCurrentTrack(trackId) {
  try {
    const groups = await getAllGroups();
    const matchedGroup = findGroupContainingTrack(groups, trackId);

    if (matchedGroup && matchedGroup[0] === trackId) {
      console.log('Track is the first in a group. Enqueuing the rest of the group.');
      // Enqueue the rest of the group
      const tracksToEnqueue = matchedGroup.slice(1);
      for (const id of tracksToEnqueue) {
        await enqueueTrack(id);
      }

      // Notify the user
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Spotify Group Shuffle',
        message: 'A group of songs has been queued to play in order.',
      });
    } else {
      console.log('Track is not part of any group or not the first in a group.');
    }
  } catch (error) {
    console.error('Error handling current track:', error);
  }
}

// Function to fetch user playlists
async function fetchUserPlaylists() {
  const token = await getAccessToken();
  let playlists = [];
  let nextURL = `${SPOTIFY_API_BASE}/me/playlists?limit=50`;

  while (nextURL) {
    const response = await fetch(nextURL, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch playlists.');
    }

    const data = await response.json();
    playlists = playlists.concat(data.items);
    nextURL = data.next;
  }

  return playlists;
}

// Function to fetch tracks from a playlist
async function fetchPlaylistTracks(playlistId) {
  const token = await getAccessToken();
  let tracks = [];
  let nextURL = `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=100`;

  while (nextURL) {
    const response = await fetch(nextURL, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch playlist tracks.');
    }

    const data = await response.json();
    // Map to extract the track object from each item
    const fetchedTracks = data.items.map(item => item.track).filter(track => track !== null);
    tracks = tracks.concat(fetchedTracks);
    nextURL = data.next;
  }

  return tracks;
}

// Function to save a group of songs
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

// Function to get groups for a playlist
async function getGroups(playlistId) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['groups'], (result) => {
      const groups = result.groups || {};
      resolve(groups[playlistId] || []);
    });
  });
}

// Function to get all groups across playlists
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

// Function to find a group containing the current track
function findGroupContainingTrack(groups, trackId) {
  for (const group of groups) {
    if (group.includes(trackId)) {
      return group;
    }
  }
  return null;
}

// Function to enqueue a track using Spotify Web API
async function enqueueTrack(trackId) {
  const token = await getAccessToken();
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/queue?uri=spotify:track:${trackId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to enqueue track ${trackId}.`);
  }
}

// Function to get grouped songs (for potential future enhancements)
async function getGroupedSongs() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['groups'], (result) => {
      const groups = result.groups || {};
      // Flatten all groups into a single array of song IDs
      const groupedSongs = [];
      for (const playlistId in groups) {
        groups[playlistId].forEach(group => {
          groupedSongs.push(...group);
        });
      }
      resolve(groupedSongs);
    });
  });
}

// Function to transfer playback to a specific device (Optional)
async function transferPlaybackHere(device_id) {
  const token = await getAccessToken();
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    method: 'PUT',
    body: JSON.stringify({
      device_ids: [device_id],
      play: true,
    }),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to transfer playback to the new device.');
  }
}

// Listen for installation to authenticate
chrome.runtime.onInstalled.addListener(() => {
  authenticate().catch(err => console.error('Failed to authenticate on install:', err.message || err));
});
