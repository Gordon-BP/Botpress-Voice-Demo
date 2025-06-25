//src/App.tsx
import React, { useState, useEffect } from 'react';
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
  const [status, setStatus] = useState<string>("Press and hold Space Bar to record");

  // Effect to request microphone access and setup the media recorder.
  useEffect(() => {
    async function getMicrophone() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        setAudioRecorder(mediaRecorder);
      } catch (error) {
        console.error('Error accessing media devices.', error);
      }
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
        console.log("Updating chatbot state...")
        setChatbotText(data.result.text);  // Update the state with the new text from the response.
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
      setStatus("Processing Text to Speech");
      // Potentially here additional functionality could handle the processed text.
    }
  }, [chatbotText]);

  // Rendering the main App component with the Chatbot component.
  return (
    <div className="App">
      <h1 style={{ color: recording ? 'red' : 'black' }}>
        {status}
      </h1>
      <div style={{
        width: '80vw',
        height: '80vh',
        margin: 'auto',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }}>
        <Chatbot userInput={chatbotText} onUpdateStatus={setStatus} />  {/* Pass the text and status update function as props to Chatbot */}
      </div>
    </div>
  );
};

export default App;
