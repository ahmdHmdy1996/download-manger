const axios = require('axios');
const path = require('path');
const https = require('https');
const http = require('http');

class NetworkUtils {
  static getAxiosConfig(url, options = {}) {
    let targetUrl = url.trim(); // Use trimmed URL directly to preserve exact query params
    try {
      // Validate URL but use original string
      const urlObj = new URL(targetUrl);
      
      const isHttps = urlObj.protocol === 'https:';
      const agentOptions = {
        keepAlive: true,
        rejectUnauthorized: false
      };

      console.log(`[NetworkUtils] Requesting: ${targetUrl}`);

      return {
        url: targetUrl, // Explicitly set URL in config
        timeout: options.timeout || 60000, // Increased default timeout
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
        httpsAgent: isHttps ? new https.Agent(agentOptions) : undefined,
        httpAgent: !isHttps ? new http.Agent({ keepAlive: true }) : undefined,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive',
          ...options.headers
        },
        ...options
      };
    } catch (e) {
      console.error('[NetworkUtils] Invalid URL provided:', url);
      throw new Error('Invalid URL');
    }
  }

  static async fetchFileInfo(url) {
    // Ensure URL is clean
    const cleanUrl = url.trim();
    let retries = 3;
    let lastError;

    // Try HEAD request first
    for (let i = 0; i < retries; i++) {
      try {
        const config = this.getAxiosConfig(cleanUrl, { method: 'HEAD' });
        const response = await axios(config);
        return this.processResponse(response, cleanUrl);
      } catch (error) {
        lastError = error;
        // If 405 Method Not Allowed or 403 Forbidden, try GET immediately
        if (error.response && (error.response.status === 405 || error.response.status === 403)) {
          console.log('HEAD request failed, trying GET...');
          break; 
        }
        if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }

    // Fallback to GET request (using Range: bytes=0-0 to get headers without downloading full file)
    try {
      const config = this.getAxiosConfig(cleanUrl, { 
        method: 'GET',
        headers: { 'Range': 'bytes=0-0' }
      });
      const response = await axios(config);
      return this.processResponse(response, cleanUrl);
    } catch (error) {
      console.error('GET fallback failed:', error.message);
      // If even GET fails, throw the original error or the new one
      throw lastError || error;
    }
  }

  static processResponse(response, url) {
    const totalSize = parseInt(response.headers['content-length'] || 0);
    const supportsRanges = response.headers['accept-ranges'] === 'bytes' || 
                          (response.headers['content-range'] && response.headers['content-range'].includes('bytes'));
    const filename = this.getFilenameFromHeaders(response.headers, url);
    return { totalSize, supportsRanges, filename };
  }

  static getFilenameFromHeaders(headers, url) {
    let filename = null;
    const contentDisposition = headers['content-disposition'];
    
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }

    if (!filename) {
      try {
        const urlPath = new URL(url).pathname;
        filename = path.basename(urlPath);
      } catch (e) {
        // Invalid URL, use timestamp
      }
    }

    return filename || `download_${Date.now()}`;
  }
}

module.exports = NetworkUtils;
