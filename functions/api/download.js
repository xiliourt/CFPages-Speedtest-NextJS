// File: functions/api/download.js
// Streams a configurable amount of data for download speed testing.
// Accessed via /api/download?size=<bytes>

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const requestedSize = url.searchParams.get('size');

  // --- Configuration ---
  // Default size if no 'size' parameter is provided or if it's invalid
  const DEFAULT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  const MIN_FILE_SIZE_BYTES = 1 * 1024; // 1 KB
  // Increased max size for flexibility
  const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 500 MB (Adjust as needed for your limits)

  let fileSize = DEFAULT_FILE_SIZE_BYTES;

  /**
   * Generates a chunk of random data using the Web Crypto API.
   * @param {number} size - The size of the chunk to generate in bytes.
   * @returns {Uint8Array} A buffer filled with random data.
   */
  function generateRandomChunk(size) {
    // Create a buffer of the specified size.
    const buffer = new Uint8Array(size);
    // Use the Web Crypto API to fill the buffer with random values.
    // This is a single, fast operation.
    crypto.getRandomValues(buffer);
    return buffer;
  }

  if (requestedSize) {
    const parsedSize = parseInt(requestedSize, 10);
    if (!isNaN(parsedSize) && parsedSize >= MIN_FILE_SIZE_BYTES && parsedSize <= MAX_FILE_SIZE_BYTES) {
      fileSize = parsedSize;
    } else {
      // Optionally, you could return an error for invalid size parameter
      // For now, it falls back to default.
      console.log(`Invalid or out-of-range size parameter received: ${requestedSize}. Using default size.`);
    }
  }

  // --- End Configuration ---

  let bytesSent = 0;
  // --- CHUNK SIZE INCREASED ---
  // Increased from 64KB to 256KB. Larger chunks can improve throughput
  // by reducing the overhead of processing each chunk, but may increase
  // memory usage and latency on slower networks.
  const chunkSize = 64 * 1024; // 256KB

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Or specify your frontend domain
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const stream = new ReadableStream({
    async pull(controller) {
      // CORRECTED: Use the validated `fileSize` instead of the raw `requestedSize`.
      if (bytesSent >= fileSize) {
        controller.close();
        return;
      }

      // CORRECTED: Calculate remaining bytes based on `fileSize`.
      const bytesRemaining = fileSize - bytesSent;
      const currentChunkSize = Math.min(chunkSize, bytesRemaining);

      try {
        const chunk = generateRandomChunk(currentChunkSize);
        controller.enqueue(chunk);
        bytesSent += currentChunkSize;
      } catch (error) {
        console.error("Error generating or enqueuing chunk:", error);
        controller.error(error); // Signal an error to the stream
      }
    },
    cancel(reason) {
      console.log('Download stream cancelled by client.', reason);
      // Perform any cleanup here if necessary
    }
  });

  // CORRECTED: Consolidated into a single, valid Response object.
  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileSize.toString(), // Crucial: Reflects the actual size being sent
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}

export async function onRequestOptions(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Or specify your frontend domain
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range', // Added Range for potential future use
  };
  return new Response(null, {
    status: 204, // No Content
    headers: corsHeaders
  });
}
