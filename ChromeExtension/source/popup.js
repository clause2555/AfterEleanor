// popup.js

document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
});

/**
 * Initializes the popup by fetching and displaying playlists.
 */
async function initializePopup() {
  try {
    // Fetch and display playlists
    const playlists = await fetchPlaylists();
    displayPlaylists(playlists);
  } catch (error) {
    console.error('Initialization error:', error.message || error);
    showError(`Failed to initialize the extension: ${error.message || error}`);
  }
}

/**
 * Sends a message to background.js to fetch the user's Spotify playlists.
 * @returns {Promise<Array>} - A promise that resolves to an array of playlists.
 */
async function fetchPlaylists() {
  return new Promise((resolve, reject) => {
    console.log('Sending FETCH_PLAYLISTS message');
    chrome.runtime.sendMessage({ type: 'FETCH_PLAYLISTS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError.message);
      } else if (response.error) {
        console.error('API error:', response.error);
        reject(response.error);
      } else {
        console.log('Received playlists:', response.playlists);
        resolve(response.playlists);
      }
    });
  });
}

/**
 * Displays the fetched playlists in the popup UI.
 * @param {Array} playlists - An array of Spotify playlist objects.
 */
function displayPlaylists(playlists) {
  const playlistsContainer = document.getElementById('playlists');
  playlistsContainer.innerHTML = '';

  playlists.forEach(playlist => {
    const playlistElement = document.createElement('div');
    playlistElement.classList.add('playlist-item');
    playlistElement.textContent = playlist.name;
    playlistElement.dataset.id = playlist.id;
    playlistElement.addEventListener('click', () => {
      selectPlaylist(playlist.id, playlist.name);
    });
    playlistsContainer.appendChild(playlistElement);
  });
}

/**
 * Handles the selection of a playlist by the user.
 * @param {string} playlistId - The ID of the selected playlist.
 * @param {string} playlistName - The name of the selected playlist.
 */
async function selectPlaylist(playlistId, playlistName) {
  try {
    // Highlight selected playlist
    document.querySelectorAll('.playlist-item').forEach(item => {
      item.classList.remove('selected');
    });
    const selectedElement = document.querySelector(`.playlist-item[data-id="${playlistId}"]`);
    if (selectedElement) {
      selectedElement.classList.add('selected');
    }

    // Fetch tracks
    const tracks = await fetchTracks(playlistId);
    displayTracks(tracks, playlistId, playlistName);
  } catch (error) {
    console.error('Error selecting playlist:', error);
    showError('Failed to load tracks. Please try again.');
  }
}

/**
 * Sends a message to background.js to fetch tracks of a specific playlist.
 * @param {string} playlistId - The ID of the playlist whose tracks are to be fetched.
 * @returns {Promise<Array>} - A promise that resolves to an array of tracks.
 */
async function fetchTracks(playlistId) {
  return new Promise((resolve, reject) => {
    console.log('Sending FETCH_TRACKS message for playlist ID:', playlistId);
    chrome.runtime.sendMessage({ type: 'FETCH_TRACKS', playlistId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError.message);
      } else if (response.error) {
        console.error('API error:', response.error);
        reject(response.error);
      } else {
        console.log('Received tracks:', response.tracks);
        resolve(response.tracks);
      }
    });
  });
}

/**
 * Displays the fetched tracks in the popup UI, allowing users to select and group them.
 * @param {Array} tracks - An array of Spotify track objects or arrays containing track objects.
 * @param {string} playlistId - The ID of the current playlist.
 * @param {string} playlistName - The name of the current playlist.
 */
async function displayTracks(tracks, playlistId, playlistName) {
  const tracksContainer = document.getElementById('tracks');
  const playlistControls = document.getElementById('playlist-controls');
  tracksContainer.innerHTML = '';

  console.log('Displaying tracks:', tracks); // Debugging log

  // Check if tracks is a multidimensional array
  if (Array.isArray(tracks) && Array.isArray(tracks[0])) {
    console.log('Flattening the tracks array.');
    tracks = tracks.flat(); // Flatten the array by one level
    console.log('Flattened tracks:', tracks); // Debugging log
  }

  if (!tracks || tracks.length === 0) {
    tracksContainer.textContent = 'No tracks found in this playlist.';
    return;
  }

  // Display Playlist Name
  const playlistHeader = document.getElementById('playlist-name');
  playlistHeader.textContent = `Playlist: ${playlistName}`;

  // Create a list of tracks with checkboxes for grouping
  tracks.forEach(track => {
    // If track is an array, extract the first element
    if (Array.isArray(track)) {
      track = track[0];
    }

    // Ensure track is an object with required properties
    if (track && typeof track === 'object' && track.id && track.name && track.artists) {
      const trackElement = document.createElement('div');
      trackElement.classList.add('track-item');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = track.id;
      checkbox.id = `track-${track.id}`;

      const label = document.createElement('label');
      label.htmlFor = `track-${track.id}`;
      label.textContent = `${track.name} by ${track.artists.map(artist => artist.name).join(', ')}`;

      trackElement.appendChild(checkbox);
      trackElement.appendChild(label);
      tracksContainer.appendChild(trackElement);
    } else {
      console.warn('Invalid track data:', track); // Warning for invalid track structure
    }
  });

  // Show the group creation controls
  const groupControls = document.getElementById('group-controls');
  groupControls.style.display = 'block';

  // Handle Create Group Button Click
  const createGroupButton = document.getElementById('create-group-button');
  createGroupButton.onclick = () => {
    const selectedTrackIds = Array.from(tracksContainer.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.value);

    if (selectedTrackIds.length < 2) {
      alert('Please select at least two songs to create a group.');
      return;
    }

    saveGroup(playlistId, selectedTrackIds);
  };

  // Show playlist controls
  playlistControls.style.display = 'block';

  // Load and display existing groups for the selected playlist
  await loadExistingGroups(playlistId);
}


/**
 * Sends a message to the background script to save a group of selected tracks.
 * @param {string} playlistId - The ID of the playlist where the group is to be saved.
 * @param {Array} trackIds - An array of track IDs that form the group.
 */
async function saveGroup(playlistId, trackIds) {
  try {
    await new Promise((resolve, reject) => {
      console.log('Sending SAVE_GROUP message for playlist ID:', playlistId, 'Track IDs:', trackIds);
      chrome.runtime.sendMessage({ type: 'SAVE_GROUP', playlistId, trackIds }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError.message);
        } else if (response.error) {
          console.error('API error:', response.error);
          reject(response.error);
        } else {
          console.log('Group saved successfully.');
          resolve(response.success);
        }
      });
    });

    alert('Group saved successfully!');
    // Refresh the groups display to include the newly created group
    const playlistIdSelected = document.querySelector('.playlist-item.selected').dataset.id;
    await loadExistingGroups(playlistIdSelected);
  } catch (error) {
    console.error('Error saving group:', error);
    showError('Failed to save group. Please try again.');
  }
}

/**
 * Sends a message to the background script to fetch existing groups for a specific playlist.
 * @param {string} playlistId - The ID of the playlist whose groups are to be fetched.
 */
async function loadExistingGroups(playlistId) {
  try {
    const groups = await new Promise((resolve, reject) => {
      console.log('Sending GET_GROUPS message for playlist ID:', playlistId);
      chrome.runtime.sendMessage({ type: 'GET_GROUPS', playlistId }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError.message);
        } else if (response.error) {
          console.error('API error:', response.error);
          reject(response.error);
        } else {
          console.log('Received groups:', response.groups);
          resolve(response.groups);
        }
      });
    });

    const groupsContainer = document.getElementById('groups');
    groupsContainer.innerHTML = '';

    if (groups.length === 0) {
      groupsContainer.textContent = 'No groups created for this playlist.';
      return;
    }

    groups.forEach((group, index) => {
      const groupElement = document.createElement('div');
      groupElement.classList.add('group-item');
      groupElement.textContent = `Group ${index + 1}: ${group.length} songs`;
      groupsContainer.appendChild(groupElement);
    });
  } catch (error) {
    console.error('Error loading groups:', error);
    showError('Failed to load groups. Please try again.');
  }
}

/**
 * Displays an error message in the popup UI.
 * @param {string} message - The error message to display.
 */
function showError(message) {
  const errorContainer = document.getElementById('error-message');
  errorContainer.textContent = message;
  errorContainer.style.display = 'block';

  // Automatically hide the error message after 5 seconds
  setTimeout(() => {
    errorContainer.style.display = 'none';
  }, 5000);
}
