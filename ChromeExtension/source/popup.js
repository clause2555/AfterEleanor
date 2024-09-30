// popup.js

document.addEventListener('DOMContentLoaded', () => {
    initializePopup();
  });
  
  async function initializePopup() {
    try {
      // Initialize the Spotify Player
      await initializePlayer();
  
      // Fetch and display playlists
      const playlists = await fetchPlaylists();
      displayPlaylists(playlists);
    } catch (error) {
      console.error('Initialization error:', error);
      showError('Failed to initialize the extension. Please try again.');
    }
  }
  
  // Send a message to background.js to fetch playlists
  async function fetchPlaylists() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'FETCH_PLAYLISTS' }, (response) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.playlists);
        }
      });
    });
  }
  
  // Display Playlists in the Popup UI
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
  
  // Handle Playlist Selection
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
  
  // Send a message to background.js to fetch tracks of a playlist
  async function fetchTracks(playlistId) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'FETCH_TRACKS', playlistId }, (response) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.tracks);
        }
      });
    });
  }
  
  // Display Tracks and Allow Grouping
  async function displayTracks(tracks, playlistId, playlistName) {
    const tracksContainer = document.getElementById('tracks');
    tracksContainer.innerHTML = '';
  
    // Display Playlist Name
    const playlistHeader = document.getElementById('playlist-name');
    playlistHeader.textContent = `Playlist: ${playlistName}`;
  
    // Create a list of tracks with checkboxes
    tracks.forEach(track => {
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
    });
  
    // Show the group creation controls
    const groupControls = document.getElementById('group-controls');
    groupControls.style.display = 'block';
  
    // Handle Create Group Button
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
  
    // Load and display existing groups
    await loadExistingGroups(playlistId);
  }
  
  // Save a Group of Songs
  async function saveGroup(playlistId, trackIds) {
    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'SAVE_GROUP', playlistId, trackIds }, (response) => {
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.success);
          }
        });
      });
  
      alert('Group saved successfully!');
      // Refresh the groups display
      await loadExistingGroups(playlistId);
    } catch (error) {
      console.error('Error saving group:', error);
      showError('Failed to save group. Please try again.');
    }
  }
  
  // Load and Display Existing Groups
  async function loadExistingGroups(playlistId) {
    try {
      const groups = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_GROUPS', playlistId }, (response) => {
          if (response.error) {
            reject(response.error);
          } else {
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
  
  // Initialize the Spotify Player (Optional: Depending on implementation)
  async function initializePlayer() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'INIT_PLAYER' }, (response) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.success);
        }
      });
    });
  }
  
  // Show Error Message in the Popup
  function showError(message) {
    const errorContainer = document.getElementById('error-message');
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  
    // Hide after 5 seconds
    setTimeout(() => {
      errorContainer.style.display = 'none';
    }, 5000);
  }
  