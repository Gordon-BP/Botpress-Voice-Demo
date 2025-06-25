//src/App.tsx
import React, { useState, useEffect } from 'react';
import './App.css';
import Chatbot from './Chatbot';

// Define interfaces for handling and typing API response data related to speech-to-text results.
interface Word {
  end: number;
  start: number;
  word: string;
}

interface Result {
  text: string;
  vtt: string;
  word_count: number;
  words: Word[];
}

interface ApiResponse {
  result: Result;
  success: boolean;
}

// Main App component that orchestrates the chatbot functionality.
const App: React.FC = () => {
  // State management for audio recording and chatbot text.
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState<boolean>(false);
  const [chatbotText, setChatbotText] = useState<string>("");
  const [status, setStatus] = useState<string>("Press and hold space bar to speak");
  const [loading, setLoading] = useState(false);

  // Effect to request microphone access and setup the media recorder.
  useEffect(() => {
    async function getMicrophone() {
      try {
        setLoading(true);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        setAudioRecorder(mediaRecorder);
      } catch (error) {
        console.error('Error accessing media devices.', error);
      } finally { setLoading(false); }
    }

    getMicrophone();
  }, []);

  // Keyboard event handlers for starting and stopping the audio recorder.
  useEffect(() => {
    const downHandler = (event: KeyboardEvent) => {
      if (event.key === ' ' && audioRecorder && !recording) {
        audioRecorder.start();
        setRecording(true);
        setStatus('Recording started...');
      }
    };

    const upHandler = (event: KeyboardEvent) => {
      if (event.key === ' ' && audioRecorder && recording) {
        audioRecorder.stop();
        setRecording(false);
        setStatus("Processing speech to text...");
      }
    };

    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);

    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [audioRecorder, recording]);

  // Handle audio recording data availability and process the recorded chunks.
  useEffect(() => {
    if (audioRecorder) {
      let chunks: BlobPart[] = [];
      audioRecorder.ondataavailable = (event: BlobEvent) => {
        chunks.push(event.data);
        console.log('Chunk received', event.data.size);
      };

      audioRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const arrayBuffer = await blob.arrayBuffer();
        postData(arrayBuffer);
        chunks = [];  // Reset chunks array to prepare for next recording.
      };
    }
  }, [audioRecorder]);

  // Function to send audio data to the server for speech-to-text processing.
  async function postData(arrayBuffer: ArrayBuffer) {
    setStatus("Sending data to Botpress...");
    try {
      console.log("Sending data to endpoint...");
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: arrayBuffer,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      const data: ApiResponse = await response.json();
      if (data.success) {
        console.log(data.result.text);
        setChatbotText(data.result.text);  // Update the state with the new text from the response.

        setStatus("Bot is processing...");
      } else {
        console.error('API did not return success');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  // Effect to handle chatbot text changes and process for text-to-speech.
  useEffect(() => {
    if (chatbotText !== "") {
      setStatus("Press and hold space bar to speak");
      // Potentially here additional functionality could handle the processed text.
    }
  }, [chatbotText]);

  // Rendering the main App component with the Chatbot component.
  return (
    <div className="app-shell">
      {/* ── Top Bar ───────────────────────────── */}
      <header className="topbar">
        <h1>🗣️ Botpress Voice Demo</h1>
        <nav className="links">
          <a href="https://hanakano.com" target="_blank" rel="noreferrer">
            Hanakano&nbsp;Consulting
          </a>
          <a href="https://github.com/gordon-bp/botpress-voice-demo" target="_blank" rel="noreferrer">
            GitHub&nbsp;Repo
          </a>
        </nav>
      </header>

      {/* ── Main Content ─────────────────────── */}
      <main className="main">
        <div className="chatbox">
          <Chatbot userInput={chatbotText} onUpdateStatus={setStatus} />
        </div>

        <div className="status" style={{ color: recording ? '#ef5350' : '#e0e0e0' }}>
          {status}
        </div>
        {loading && <div className="spinner" />}
      </main>
    </div>
  );
};

export default App;
