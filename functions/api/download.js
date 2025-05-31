// File: functions/api/download.js
// Streams a configurable amount of data for download speed testing.
// Accessed via /api/download

export async function onRequestGet(context) {
  const { request } = context;

  const fileSize = 10 * 1024 * 1024; // 10 MB - MUST match frontend
  let bytesSent = 0;
  const chunkSize = 64 * 1024;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const readableStream = new ReadableStream({
    pull(controller) {
      if (bytesSent >= fileSize) {
        controller.close();
        return;
      }
      const bytesToSend = Math.min(chunkSize, fileSize - bytesSent);
      const chunk = new Uint8Array(bytesToSend);
      for (let i = 0; i < bytesToSend; i++) {
        chunk[i] = 97; // 'a'
      }
      controller.enqueue(chunk);
      bytesSent += bytesToSend;
    },
    cancel(reason) {
      console.log('Download stream cancelled:', reason);
    }
  });

  return new Response(readableStream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileSize.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}

export async function onRequestOptions(context) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    return new Response(null, { headers: corsHeaders });
}
