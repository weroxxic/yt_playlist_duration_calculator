// YouTube API setup
const API_KEY = 'AIzaSyBBY1uye6_oCKViJesQkxIrXw8Kpn6mKRY'; // Replace with your actual API key

// DOM elements
const playlistUrlInput = document.getElementById('playlist-url');
const calculateBtn = document.getElementById('calculate-btn');
const totalVideosElement = document.getElementById('total-videos');
const totalDurationElement = document.getElementById('total-duration');
const progressContainer = document.querySelector('.progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const resultSection = document.querySelector('.result-section');
const errorMessageElement = document.getElementById('error-message');
const videosListElement = document.getElementById('videos-list');
const downloadPdfBtn = document.getElementById('download-pdf');

let gapiLoaded = false;
let playlistVideos = []; // Store all videos data for PDF generation
let playlistName = 'YouTube Playlist'; // Store playlist name for PDF

// Load the Google API client
function loadGAPI() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            gapi.load('client', () => {
                gapi.client.init({
                    'apiKey': API_KEY,
                    'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest']
                }).then(() => {
                    gapiLoaded = true;
                    resolve();
                }).catch(error => {
                    reject(error);
                });
            });
        };
        script.onerror = () => {
            reject(new Error('Failed to load Google API'));
        };
        document.body.appendChild(script);
    });
}

// Extract playlist ID from URL
function extractPlaylistId(url) {
    // If it's already just an ID
    if (!url.includes('youtube.com') && !url.includes(' ')) {
        return url;
    }
    
    // Extract from URL
    const regExp = /^.*(youtu.be\/|list=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2] ? match[2] : null;
}

// Convert ISO 8601 duration to seconds
function convertDurationToSeconds(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    
    const hours = (match[1] ? parseInt(match[1].slice(0, -1)) : 0);
    const minutes = (match[2] ? parseInt(match[2].slice(0, -1)) : 0);
    const seconds = (match[3] ? parseInt(match[3].slice(0, -1)) : 0);
    
    return hours * 3600 + minutes * 60 + seconds;
}

// Convert seconds to HH:MM:SS format
function secondsToHms(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0')
    ].join(':');
}

// Show error message
function showError(message) {
    errorMessageElement.textContent = message;
    errorMessageElement.classList.remove('hidden');
}

// Hide error message
function hideError() {
    errorMessageElement.classList.add('hidden');
}

// Add video to the list display
function addVideoToList(videoId, title, duration) {
    const videoElement = document.createElement('div');
    videoElement.className = 'video-item';
    
    const formattedDuration = formatDurationForDisplay(duration);
    
    videoElement.innerHTML = `
        <a href="https://youtu.be/${videoId}" target="_blank" class="video-title">${title}</a>
        <span class="video-duration">${formattedDuration}</span>
    `;
    
    videosListElement.appendChild(videoElement);
    
    // Add to our videos array for PDF generation
    playlistVideos.push({
        id: videoId,
        title: title,
        duration: formattedDuration,
        url: `https://youtu.be/${videoId}`
    });
}

// Format duration for display (simpler than the full HH:MM:SS)
function formatDurationForDisplay(duration) {
    const seconds = convertDurationToSeconds(duration);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Generate and download PDF
function downloadAsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text(playlistName, 105, 15, { align: 'center' });
    
    // Stats
    doc.setFontSize(12);
    doc.text(`Total Videos: ${totalVideosElement.textContent}`, 14, 25);
    doc.text(`Total Duration: ${totalDurationElement.textContent}`, 14, 32);
    
    // Videos table
    const tableData = playlistVideos.map(video => [
        video.title,
        video.duration,
        video.url
    ]);
    
    doc.autoTable({
        head: [['Title', 'Duration', 'Link']],
        body: tableData,
        startY: 40,
        styles: {
            fontSize: 10,
            cellPadding: 3,
            overflow: 'linebreak'
        },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 30 },
            2: { cellWidth: 60 }
        },
        didDrawPage: function (data) {
            // Footer
            doc.setFontSize(10);
            doc.text('Generated by YouTube Playlist Duration Calculator', 
                    data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
    });
    
    // Clean filename and save the PDF
    const cleanName = playlistName
        .replace(/[^a-z0-9\s]/gi, '') // Remove special chars
        .trim() // Trim whitespace
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, 50); // Limit length
    
    doc.save(`${cleanName || 'YouTube_Playlist'}.pdf`);
}

// Calculate total duration of all videos in a playlist
async function calculatePlaylistDuration(playlistId) {
    try {
        if (!gapiLoaded) {
            await loadGAPI();
        }

        // First, get playlist details to know how many videos there are
        const playlistResponse = await gapi.client.youtube.playlists.list({
            part: 'snippet,contentDetails',
            id: playlistId,
            maxResults: 1
        });
        
        if (!playlistResponse.result.items || playlistResponse.result.items.length === 0) {
            throw new Error('Playlist not found or inaccessible');
        }
        
        // Store playlist name
        playlistName = playlistResponse.result.items[0].snippet.title || 'YouTube Playlist';
        const itemCount = playlistResponse.result.items[0].contentDetails.itemCount;
        totalVideosElement.textContent = itemCount;
        
        // Show progress bar
        progressContainer.classList.remove('hidden');
        
        // Clear previous videos
        videosListElement.innerHTML = '';
        playlistVideos = [];
        
        let nextPageToken = '';
        let totalDuration = 0;
        let processedVideos = 0;
        
        // Fetch all playlist items in pages
        do {
            const playlistItemsResponse = await gapi.client.youtube.playlistItems.list({
                part: 'snippet,contentDetails',
                playlistId: playlistId,
                maxResults: 50,
                pageToken: nextPageToken
            });
            
            nextPageToken = playlistItemsResponse.result.nextPageToken || '';
            
            // Get video IDs and titles
            const videoData = playlistItemsResponse.result.items.map(item => ({
                id: item.contentDetails.videoId,
                title: item.snippet.title
            }));
            
            // Get video details (including duration)
            const videosResponse = await gapi.client.youtube.videos.list({
                part: 'contentDetails,snippet',
                id: videoData.map(v => v.id).join(','),
                maxResults: 50
            });
            
            // Process videos
            videosResponse.result.items.forEach((video, index) => {
                const duration = video.contentDetails.duration;
                totalDuration += convertDurationToSeconds(duration);
                processedVideos++;
                
                // Add to the videos list
                addVideoToList(
                    video.id,
                    video.snippet.title,
                    video.contentDetails.duration
                );
                
                // Update progress
                const progress = Math.round((processedVideos / itemCount) * 100);
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `${progress}%`;
            });
            
            // Update total duration display as we go
            totalDurationElement.textContent = secondsToHms(totalDuration);
            
        } while (nextPageToken);
        
        // Show download button when done
        downloadPdfBtn.classList.remove('hidden');
        
        return totalDuration;
        
    } catch (error) {
        console.error('Error calculating playlist duration:', error);
        showError(error.message || 'An error occurred while calculating the duration');
        return null;
    }
}

// Event listeners
calculateBtn.addEventListener('click', async () => {
    const playlistUrl = playlistUrlInput.value.trim();
    
    if (!playlistUrl) {
        showError('Please enter a YouTube playlist URL or ID');
        return;
    }
    
    const playlistId = extractPlaylistId(playlistUrl);
    
    if (!playlistId) {
        showError('Invalid YouTube playlist URL or ID');
        return;
    }
    
    try {
        hideError();
        calculateBtn.disabled = true;
        calculateBtn.textContent = 'Calculating...';
        
        // Show result section
        resultSection.classList.remove('hidden');
        
        // Hide download button initially
        downloadPdfBtn.classList.add('hidden');
        
        // Reset progress
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        totalVideosElement.textContent = '0';
        totalDurationElement.textContent = '00:00:00';
        
        // Calculate duration
        await calculatePlaylistDuration(playlistId);
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'An error occurred while calculating the duration');
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.textContent = 'Calculate Duration';
    }
});

// Download PDF button
downloadPdfBtn.addEventListener('click', downloadAsPDF);

// Also trigger calculation on Enter key
playlistUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        calculateBtn.click();
    }
});