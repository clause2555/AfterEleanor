# After Eleanor - Spotify Group Shuffle

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Chrome Web Store](https://img.shields.io/badge/Chrome-Web_Store-green.svg)

Spotify Group Shuffle is a Chrome extension designed for Spotify users who enjoy jam band music and other genres where certain songs are best experienced in a specific sequence. This extension allows users to group songs within their playlists, ensuring that these groups play in order even when shuffle mode is enabled.

## Table of Contents

- [🎶 About](#-about)
- [🚀 Features](#-features)
- [🛠️ Installation](#️-installation)
- [🎨 Usage](#-usage)
- [🔧 Development](#-development)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)

## 🎶 About

Spotify's shuffle feature is great for discovering new music, but it can disrupt the intended flow of playlists, especially for genres like jam bands where multiple tracks create a cohesive experience. **After Eleanor** solves this by allowing users to define groups of songs that will always play in sequence, maintaining the integrity of their musical journey even in shuffle mode.

The name comes from a friend of mine who offered up the idea one morning saying that he wished Spotify could group songs together like the Jerry Garcia Band's After Midnight > Eleanor Rigby > After Midnight sequence.

## 🚀 Features

- **User Authentication**: Securely connect your Spotify account using OAuth 2.0.
- **Playlist Access**: Browse and select from your Spotify playlists.
- **Song Grouping**: Easily select and group multiple songs to play sequentially.
- **Queue Monitoring**: Automatically detects when a grouped song is about to play.
- **Queue Adjustment**: Reorders the playback queue to ensure grouped songs play in order.
- **Intuitive UI**: Manage your groups with a user-friendly interface directly from the browser.

## 🛠️ Installation

### Prerequisites

- **Google Chrome** browser installed.
- A **Spotify** account with existing playlists.

### Steps

1. **Clone the Repository**

   ```bash
   git clone https://github.com/clause2555/AfterEleanor.git

2. **Navigate to the Project Directory**

    ```bash
    cd AfterEleanor

3. **Register Your Application with Spotify**

    - Go to the Spotify Developer Dashboard
    - Click Creat an App and fill in the required information
    - Note down your Client ID and Client Secret
    - Currently you will need to skip forward and load the Extension into Chrome so that it errors and logs the temporary Redirect URI that should go into the          SDD.
    - NOTE THIS STEP IS ONLY WHILE THIS IS IN DEVELOPMENT, ONCE COMPLETE THIS WILL BE UNNECESSARY

4. **Configure the Extension**
    
    - Open the manifest.json file in the project root
    - Replace YOUR_SPOTIFY_CLIENT_ID with the actual Client ID from above
    - Replace YOUR_REDIRECT_URI with the URI you set above

5. **Load the Extension into Chrome**

    - Open Chrome and navigate to chrome://extensions/
    - Enable Developer mode
    - Select "Load Unpacked" and select the project directory
    - AfterEleanor should appear in the list of installed extensions

### Usage

1. ***Authenticate with Spotify***

    - Click on the Spotify Group Shuffle extension icon in the Chrome toolbar.
    - Click "Login with Spotify" and authorize the extension to access your Spotify account.

2. ***Select a Playlist***
    - After authentication, your Spotify playlists will be displayed.
    - Click on the playlist you want to manage.

3. ***Group Songs***
    - In the playlist view, select the songs you wish to group by checking the corresponding checkboxes.
    - Click on "Create Group" to save the selected songs as a group.

4. ***Enable Shuffle***
    - Play your playlist and enable shuffle mode in Spotify as usual.
        The extension will automatically adjust the playback queue to ensure grouped songs play in sequence.

5. ***Manage Groups***
        Access the extension's popup to view, edit, or delete your existing groups.

### Development

1. ***Technologies Used***

    - JavaScript
    - Chrome Extensions API
    - Spotify Web API
    - HTML/CSS

### Contributing

1. ***How to Contribute***

   Any input at all is greatly appreciated. Feel free to make changes, fork the repo, send messages or anything like that.
   This is my first attempt at making a real world tool in lieu of a video games, so the paradigms are new to me :-).

### License 

1. ***MIT License***

   This tool was developed under the MIT license. See LICENSE.md for more information.

### Acknowledgements 

   I created this tool but I would like to give special thanks to my friend Gavin who tossed the idea to me one morning.
   As I mentioned before the name After Eleanor comes from a specific song sequence played by the Jerry Garcia Band. 
   The Sequence is a cover of J.J. Cale's "After Midnight" into The Beatles "Eleanor Rigby" and reprised back into
   J.J. Cale's "After Midnight".  When he presented the idea for the tool he used this sequence saying "I always have to 
   queue these songs together when my playlist is shuffled, I wish Spotify would just add this as a feature."
