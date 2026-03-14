const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API Configuration
const RAPIDAPI_KEY = '969ea55e76msh81783ee7b1e6d90p1b2aa5jsn42ee297133cd';
const RAPIDAPI_HOST = 'youtube-mp310.p.rapidapi.com';

/**
 * Get download URL from YouTube video URL
 * @param {string} videoUrl - YouTube video URL
 * @returns {Promise<string>} - Download URL for MP3
 */
const getDownloadUrl = async (videoUrl) => {
  const options = {
    method: 'GET',
    url: 'https://youtube-mp310.p.rapidapi.com/download/mp3',
    params: {
      url: videoUrl,
    },
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  };

  try {
    console.log('Fetching download URL from API...');
    const response = await axios.request(options);
    const { downloadUrl } = response.data;

    if (!downloadUrl) {
      throw new Error('No download URL received from API');
    }

    console.log('Download URL received:', downloadUrl);
    return downloadUrl;

  } catch (error) {
    console.error('Error fetching download URL:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    throw error;
  }
};

/**
 * Download MP3 file from download URL
 * @param {string} downloadUrl - Download URL obtained from API
 * @param {string} outputPath - Path to save the MP3 file
 * @returns {Promise<string>} - Path to saved file
 */
const downloadMp3 = async (downloadUrl, outputPath) => {
  try {
    console.log('Downloading MP3 file...');
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 120000,
    });

    // Create write stream
    const writer = fs.createWriteStream(outputPath);

    // Pipe the response data to file
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`MP3 successfully downloaded to: ${outputPath}`);
        resolve(outputPath);
      });

      writer.on('error', (err) => {
        console.error('Error writing file:', err.message);
        reject(err);
      });
    });

  } catch (error) {
    console.error('Error downloading the MP3:', error.message);
    throw error;
  }
};

/**
 * Main function to download YouTube video as MP3
 * @param {string} videoUrl - YouTube video URL
 * @param {string} outputDir - Directory to save the file (default: ./downloads)
 * @returns {Promise<string>} - Path to saved file
 */
const downloadYouTubeMp3 = async (videoUrl, outputDir = './downloads') => {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }

    // Get download URL from API
    const downloadUrl = await getDownloadUrl(videoUrl);

    // Generate filename from URL or timestamp
    const videoId = new URL(videoUrl).searchParams.get('v') || 'unknown';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `youtube_${videoId}_${timestamp}.mp3`;
    const outputPath = path.join(outputDir, filename);

    // Download the MP3
    const savedPath = await downloadMp3(downloadUrl, outputPath);
    return savedPath;

  } catch (error) {
    console.error('Failed to download the MP3:', error);
    throw error;
  }
};

// CLI usage
if (require.main === module) {
  // Get video URL from command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node index.js <youtube-video-url> [output-directory]');
    console.log('Example: node index.js https://www.youtube.com/watch?v=phd1U2JIfUA');
    console.log('Example: node index.js https://www.youtube.com/watch?v=phd1U2JIfUA ./music');
    process.exit(1);
  }

  const videoUrl = args[0];
  const outputDir = args[1] || './downloads';

  (async () => {
    try {
      console.log('Starting download...');
      console.log('Video URL:', videoUrl);
      console.log('Output directory:', outputDir);
      console.log('---');

      const savedPath = await downloadYouTubeMp3(videoUrl, outputDir);
      console.log('---');
      console.log('Download complete! File saved to:', savedPath);

    } catch (error) {
      console.error('Download failed:', error.message);
      process.exit(1);
    }
  })();
}

// Export functions for use as module
module.exports = {
  getDownloadUrl,
  downloadMp3,
  downloadYouTubeMp3,
};
