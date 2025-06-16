// File: functions/api/download.js
// Description: A Cloudflare Worker that streams a configurable amount of
//              random data to test download speeds.
//
// Access via: /api/download?size=<bytes>
// Example: /api/download?size=104857600  (for 100 MB)

/**
 * Handles GET requests to stream data for the speed test.
 * @param {object} context - The Cloudflare Worker context.
 * @returns {Response} A streaming response with random data.
 */
export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const requestedSize = url.searchParams.get('size');

  // --- Configuration ---
  // The size of each data chunk to be generated and sent.
  // A larger chunk size can reduce CPU overhead and potentially increase throughput,
  // but also increases memory usage per request during chunk generation.
  const CHUNK_SIZE_BYTES = 64 * 1024; // 4 MB

  // Default size if no 'size' parameter is provided or if it's invalid.
  const DEFAULT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  // Define reasonable limits for the requested download size.
  const MIN_FILE_SIZE_BYTES = 10 * 1024 * 1024;       // 10 MB
  const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 1 GB (Adjust as needed for your plan's limits)

  let fileSize = DEFAULT_FILE_SIZE_BYTES;

  // Validate the user-provided 'size' parameter.
  if (requestedSize) {
    const parsedSize = parseInt(requestedSize, 10);
    // Ensure the parsed size is a number and within the allowed range.
    if (!isNaN(parsedSize) && parsedSize >= MIN_FILE_SIZE_BYTES && parsedSize <= MAX_FILE_SIZE_BYTES) {
      fileSize = parsedSize;
    } else {
      console.log(`Invalid or out-of-range size parameter: '${requestedSize}'. Falling back to default size.`);
    }
  }

  /**
   * Generates a chunk of random data using the efficient Web Crypto API.
   * @param {number} size - The size of the chunk to generate in bytes.
   * @returns {Uint8Array} A buffer filled with random data.
   */
  function generateRandomChunk(size) {
    const buffer = new Uint8Array(size);
    crypto.getRandomValues(buffer); // Fills the buffer with cryptographically secure random values.
    return buffer;
  }

  let bytesSent = 0;

  // Use a ReadableStream to send data as it's generated, avoiding
  // the need to buffer the entire file in memory.
  const stream = new ReadableStream({
    pull(controller) {
      // Check if the download is complete.
      if (bytesSent >= fileSize) {
        controller.close();
        return;
      }

      // Determine the size of the next chunk.
      const bytesRemaining = fileSize - bytesSent;
      const currentChunkSize = Math.min(CHUNK_SIZE_BYTES, bytesRemaining);

      try {
        // Generate and send the next chunk.
        const chunk = generateRandomChunk(currentChunkSize);
        controller.enqueue(chunk);
        bytesSent += currentChunkSize;
      } catch (error) {
        console.error("Error generating or enqueuing chunk:", error);
        controller.error(error); // Abort the stream if an error occurs.
      }
    },
    cancel(reason) {
      // Logged if the client cancels the download (e.g., closes the browser tab).
      console.log('Stream cancelled by client.', reason);
    }
  });

  // These headers are essential for CORS (cross-origin requests) and caching.
  const responseHeaders = {
    'Content-Type': 'application/octet-stream', // Instructs the browser to treat this as a file download.
    'Content-Length': fileSize.toString(),       // Crucial for the client to calculate progress.
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', // Prevents caching to ensure accurate speed tests.
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
    // CORS headers to allow any frontend to access this API.
    // For production, you might want to restrict this to your domain: e.g., 'https://your-frontend.com'
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Return the streaming response.
  return new Response(stream, {
    status: 200,
    headers: responseHeaders,
  });
}

/**
 * Handles OPTIONS pre-flight requests for CORS.
 * This is required for browsers to allow cross-origin requests from your frontend.
 * @returns {Response} An empty response with CORS headers.
 */
export async function onRequestOptions(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Or specify your frontend domain
    'Access-Control-Allow-Methods': 'GET, OPTIONS', // Specifies allowed methods
    'Access-Control-Allow-Headers': 'Content-Type, Range', // Specifies allowed headers
    'Access-Control-Max-Age': '86400', // Optional: caches pre-flight response for 1 day
  };
  // A 204 "No Content" response is standard and efficient for OPTIONS requests.
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
