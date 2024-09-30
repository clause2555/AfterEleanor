// content.js

console.log('Spotify Group Shuffle: content.js injected successfully.');

(function() {
    /**
     * Function to fetch grouped songs from the background script
     * @returns {Promise<Array>} - Array of grouped song IDs
     */
    function getGroupedSongs() {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'GET_GROUPED_SONGS' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('GET_GROUPED_SONGS error:', chrome.runtime.lastError.message);
              reject(chrome.runtime.lastError.message);
            } else if (response.error) {
              console.error('GET_GROUPED_SONGS API error:', response.error);
              reject(response.error);
            } else {
              console.log('GET_GROUPED_SONGS response:', response.groupedSongs);
              resolve(response.groupedSongs); // Expecting an array of song IDs
            }
          });
        });
    }
    
    /**
     * Function to highlight grouped songs in the DOM
     */
    async function highlightGroupedSongs() {
        try {
            const groupedSongs = await getGroupedSongs();
            if (!groupedSongs || groupedSongs.length === 0) {
                console.log('No grouped songs to highlight.');
                return;
            }
    
            groupedSongs.forEach(songId => {
                // Spotify's web player might structure song elements with specific data attributes
                // Adjust the selector based on the actual DOM structure
                const songElement = document.querySelector(`[data-uri="spotify:track:${songId}"]`);
                if (songElement) {
                    // Check if the badge already exists to prevent duplication
                    if (!songElement.querySelector('.grouped-badge')) {
                        // Create a badge element
                        const badge = document.createElement('span');
                        badge.textContent = '🔗';
                        badge.classList.add('grouped-badge');
                        badge.style.marginLeft = '8px';
                        badge.style.color = '#1db954'; // Spotify green
                        songElement.appendChild(badge);
                        console.log(`Highlighted grouped song: ${songId}`);
                    }
                } else {
                    console.warn(`Song element not found for ID: ${songId}`);
                }
            });
        } catch (error) {
            console.error('Error in highlightGroupedSongs:', error);
        }
    }
    
    /**
     * Function to extract track name and artist from the DOM
     * @returns {Object|null} - Object containing trackName and artistName, or null if not found
     */
    function getCurrentTrackInfo() {
        const trackTitleElement = document.querySelector('[data-testid="context-item-info-title"] a');
        const artistElement = document.querySelector('[data-testid="context-item-info-artist"] a');
        
        if (trackTitleElement && artistElement) {
            const trackName = trackTitleElement.textContent.trim();
            const artistName = artistElement.textContent.trim();
            console.log(`Extracted Track Info - Name: ${trackName}, Artist: ${artistName}`);
            return { trackName, artistName };
        }
        console.warn('Could not find track title or artist elements.');
        return null;
    }
    
    /**
     * Function to fetch track ID from Spotify Web API based on track name and artist
     * @param {string} trackName - Name of the track
     * @param {string} artistName - Name of the artist
     * @returns {Promise<string|null>} - Track ID or null if not found
     */
    async function fetchTrackId(trackName, artistName) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'GET_ACCESS_TOKEN' }, async (response) => {
                if (chrome.runtime.lastError) {
                    console.error('GET_ACCESS_TOKEN error:', chrome.runtime.lastError.message);
                    reject(null);
                    return;
                }
                
                const accessToken = response.accessToken;
                if (!accessToken) {
                    console.error('No access token received from background script.');
                    reject(null);
                    return;
                }
                
                const query = encodeURIComponent(`track:${trackName} artist:${artistName}`);
                const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
                
                try {
                    const apiResponse = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                    
                    if (!apiResponse.ok) {
                        console.error('Spotify API error:', apiResponse.statusText);
                        reject(null);
                        return;
                    }
                    
                    const data = await apiResponse.json();
                    if (data.tracks.items.length > 0) {
                        const trackId = data.tracks.items[0].id;
                        console.log(`Fetched Track ID: ${trackId} for "${trackName}" by "${artistName}"`);
                        resolve(trackId);
                    } else {
                        console.warn(`No matching track found for "${trackName}" by "${artistName}"`);
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Error fetching track ID:', error);
                    reject(null);
                }
            });
        });
    }
    
    /**
     * Function to notify the background script of the current track
     */
    async function notifyBackgroundOfCurrentTrack() {
        const trackInfo = getCurrentTrackInfo();
        if (trackInfo) {
            const { trackName, artistName } = trackInfo;
            console.log(`Notifying background script of current track: "${trackName}" by "${artistName}"`);
            
            const trackId = await fetchTrackId(trackName, artistName);
            if (trackId) {
                chrome.runtime.sendMessage({ type: 'CURRENT_TRACK', trackId: trackId }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending CURRENT_TRACK message:', chrome.runtime.lastError.message);
                    } else {
                        console.log('CURRENT_TRACK message sent successfully.');
                    }
                });
            } else {
                console.warn('Could not retrieve track ID. CURRENT_TRACK message not sent.');
            }
        } else {
            console.warn('No track info available. CURRENT_TRACK message not sent.');
        }
    }
    
    /**
     * Function to initialize the content script functionalities
     */
    function initializeContentScript() {
        // Highlight grouped songs when the page loads
        window.addEventListener('load', () => {
            setTimeout(() => {
                highlightGroupedSongs();
                notifyBackgroundOfCurrentTrack();
            }, 3000); // Adjust timeout as needed based on Spotify's load time
        });
    
        // Listen for DOM changes to detect track changes
        const observer = new MutationObserver(() => {
            console.log('MutationObserver detected DOM changes.');
            highlightGroupedSongs();
            notifyBackgroundOfCurrentTrack();
        });
    
        // Observe changes in the now-playing-widget
        const nowPlayingWidget = document.querySelector('[data-testid="now-playing-widget"]');
        if (nowPlayingWidget) {
            observer.observe(nowPlayingWidget, { childList: true, subtree: true });
            console.log('MutationObserver attached to now-playing-widget.');
        } else {
            console.warn('now-playing-widget not found. Observer not attached.');
        }
    }
    
    // Initialize the content script
    initializeContentScript();
})();
