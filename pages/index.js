import Head from 'next/head';
import { useState, useEffect } from 'react';

// Configuration: Relative paths for Cloudflare Pages Functions
// These will be routed by Cloudflare Pages to your worker scripts
// in the `functions/api/` directory.
const PING_COUNT = 5;
const PING_API_URL = '/api/ping';
const DOWNLOAD_API_URL = '/api/download';
const DOWNLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB - MUST MATCH THE WORKER SCRIPT
const UPLOAD_API_URL = '/api/upload';
const UPLOAD_DATA_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export default function SpeedTestPage() {
    const [ping, setPing] = useState('--');
    const [downloadSpeed, setDownloadSpeed] = useState('--');
    const [uploadSpeed, setUploadSpeed] = useState('--');
    const [status, setStatus] = useState('Ready to start test.');
    const [progress, setProgress] = useState(0);
    const [isTesting, setIsTesting] = useState(false);
    const [showProgress, setShowProgress] = useState(false);

    const resetMetrics = () => {
        setPing('--');
        setDownloadSpeed('--');
        setUploadSpeed('--');
        setStatus('Ready to start test.');
        setProgress(0);
        setShowProgress(false);
    };

    const measurePing = async () => {
        setStatus('Testing Ping...');
        setPing('...');
        let pings = [];
        for (let i = 0; i < PING_COUNT; i++) {
            const startTime = performance.now();
            try {
                await fetch(`${PING_API_URL}?r=${Math.random()}`, { method: 'GET', cache: 'no-store' });
                const endTime = performance.now();
                pings.push(endTime - startTime);
            } catch (error) {
                console.error('Ping request failed:', error);
                pings.push(null);
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const validPings = pings.filter(p => p !== null);
        if (validPings.length > 0) {
            const avgPing = validPings.reduce((a, b) => a + b, 0) / validPings.length;
            setPing(Math.round(avgPing));
        } else {
            setPing('ERR');
            throw new Error('Ping test failed. Check Cloudflare Function logs.');
        }
    };

    const measureDownload = async () => {
        setStatus('Testing Download...');
        setDownloadSpeed('...');
        setShowProgress(true);
        setProgress(0);
        const startTime = performance.now();
        try {
            const response = await fetch(`${DOWNLOAD_API_URL}?r=${Math.random()}`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Download Function error: ${response.status} ${response.statusText}`);
            }
            const reader = response.body.getReader();
            let receivedLength = 0;
            // eslint-disable-next-line no-constant-condition
            while(true) {
                const {done, value} = await reader.read();
                if (done) break;
                receivedLength += value.length;
                const progressPercentage = Math.min(100, (receivedLength / DOWNLOAD_FILE_SIZE_BYTES) * 100);
                setProgress(progressPercentage);
            }
            const endTime = performance.now();
            const durationSeconds = (endTime - startTime) / 1000;
            if (durationSeconds === 0 || receivedLength === 0) {
                 setDownloadSpeed('ERR');
                 throw new Error('Download test failed (zero duration or size).');
            }
            const speedBps = (receivedLength * 8) / durationSeconds; 
            const speedMbps = (speedBps / (1000 * 1000)).toFixed(2);
            setDownloadSpeed(speedMbps);
            setProgress(100);
        } catch (error) {
            console.error('Download test failed:', error);
            setDownloadSpeed('ERR');
            setProgress(0);
            throw error;
        }
    };

    const measureUpload = () => {
        setStatus('Testing Upload...');
        setUploadSpeed('...');
        setShowProgress(true);
        setProgress(0);
        return new Promise((resolve, reject) => {
            const data = new Uint8Array(UPLOAD_DATA_SIZE_BYTES);
            for (let i = 0; i < UPLOAD_DATA_SIZE_BYTES; i++) {
                data[i] = Math.floor(Math.random() * 256); 
            }
            const blob = new Blob([data]);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${UPLOAD_API_URL}?r=${Math.random()}`, true);
            const startTime = performance.now();
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentage = Math.min(100, (event.loaded / event.total) * 100);
                    setProgress(percentage);
                }
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const endTime = performance.now();
                    const durationSeconds = (endTime - startTime) / 1000;
                    if (durationSeconds === 0) {
                       setUploadSpeed('ERR');
                       reject(new Error('Upload test failed (zero duration).'));
                       return;
                    }
                    const speedBps = (UPLOAD_DATA_SIZE_BYTES * 8) / durationSeconds;
                    const speedMbps = (speedBps / (1000 * 1000)).toFixed(2);
                    setUploadSpeed(speedMbps);
                    setProgress(100);
                    resolve();
                } else {
                    setUploadSpeed('ERR');
                    let responseText = xhr.responseText;
                    try { responseText = JSON.parse(xhr.responseText).message || xhr.responseText; } catch (e) {/*ignore*/}
                    console.error('Upload failed with status:', xhr.status, xhr.statusText, responseText);
                    reject(new Error(`Upload Function error: ${xhr.statusText || 'Server error'} (${xhr.status}). ${responseText}`));
                }
            };
            xhr.onerror = () => {
                setUploadSpeed('ERR');
                console.error('Upload network error');
                setProgress(0);
                reject(new Error('Upload network error. Check Function endpoint and CORS.'));
            };
            xhr.send(blob);
        });
    };

    const startTest = async () => {
        if (isTesting) return;
        setIsTesting(true);
        resetMetrics();
        setStatus('Initializing test...');
        try {
            await measurePing();
            await measureDownload();
            await measureUpload();
            setStatus('Test Complete!');
        } catch (error) {
            console.error("Speed test failed: ", error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <>
            <Head>
                <title>Speed Test (CF Pages & Functions)</title>
                <meta name="description" content="Measure internet speed with Next.js (Static) & Cloudflare Functions" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div className="bg-gradient-to-br from-slate-900 to-sky-900 text-slate-100 flex items-center justify-center min-h-screen p-4 font-sans selection:bg-sky-500 selection:text-white">
                <div className="bg-slate-800/70 backdrop-blur-md p-6 sm:p-10 rounded-xl shadow-2xl w-full max-w-lg ring-1 ring-slate-700">
                    <header className="text-center mb-8">
                        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">Speed Test</h1>
                        <p className="text-slate-400 mt-2 text-sm sm:text-base">Measure your connection to Cloudflare Edge.</p>
                    </header>
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8 text-center">
                        {[
                            { label: 'Ping', value: ping, unit: 'ms' },
                            { label: 'Download', value: downloadSpeed, unit: 'Mbps' },
                            { label: 'Upload', value: uploadSpeed, unit: 'Mbps' },
                        ].map(metric => (
                            <div key={metric.label} className="bg-slate-700/50 p-4 rounded-lg shadow">
                                <p className="text-xs sm:text-sm text-sky-300 uppercase tracking-wider font-medium">{metric.label}</p>
                                <p className="text-2xl sm:text-3xl font-semibold text-slate-100 my-1">{metric.value}</p>
                                <p className="text-xs text-slate-400">{metric.unit}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mb-8 h-10">
                        {showProgress && (
                            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-sky-500 to-cyan-400 h-2.5 rounded-full transition-all duration-150 ease-linear" 
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        )}
                        <p className={`text-center h-5 mt-2 text-sm ${status.includes('Error') || status.includes('⚠️') ? 'text-red-400' : 'text-sky-300'}`}>{status}</p>
                    </div>
                    <button 
                        onClick={startTest}
                        disabled={isTesting}
                        className={`w-full font-semibold py-3.5 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50
                                    ${isTesting 
                                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed focus:ring-slate-500' 
                                        : 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-cyan-500/30 focus:ring-cyan-400'
                                    } flex items-center justify-center group`}
                    >
                        {isTesting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Testing...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2 group-hover:scale-110 transition-transform">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                                </svg>
                                Start Test
                            </>
                        )}
                    </button>
                    <footer className="text-center mt-8">
                        <p className="text-xs text-slate-500">Powered by Next.js (Static) & Cloudflare Functions</p>
                    </footer>
                </div>
            </div>
        </>
    );
}
