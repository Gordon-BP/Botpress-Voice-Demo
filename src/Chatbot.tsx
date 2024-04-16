////////////////    Chatbot Component   /////////////////
//  This react component embeds the Botpress widget as //
//  An iframe inside the page, and also includes all   //
// the needed event handlers for receiving messages    //
// from the STT, sending them to the bot, and then     //
//  pushing the bot messages to the TTS service.       //
//////////////////////////////////////////////////////////
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios'

console.log(process.env)

// Define a type for the input that we'll be tossing around our services
// It also insludes an update for the status on the website
interface ChatbotProps {
    userInput: string;
    onUpdateStatus: (status: string) => void;
}

// Change this to reflect your bot's information
const botConfig = {
    composerPlaceholder: 'Chat with bot',
    botConversationDescription: 'This chatbot was built surprisingly fast with Botpress',
    botName: 'Survey Bot',
    botId: "811258c7-429f-48bf-9dda-1af8c5c8a0d5",
    hostUrl: 'https://cdn.botpress.cloud/webchat/v1',
    messagingUrl: 'https://messaging.botpress.cloud',
    clientId: "811258c7-429f-48bf-9dda-1af8c5c8a0d5",
    containerWidth: "100%25", // Needed for bot to take up entire container
    layoutWidth: "100%25", // Needed for bot to take up entire container
    disableAnimations: true, // Needed for bot to render without its widget
    hideWidget: true, // Since we are embedding the bot, no need for a widget
    enableConversationDeletion: true,
    stylesheet:"https://webchat-styler-css.botpress.app/prod/code/7c2e8673-b084-4bea-849c-1c7addf1eb04/v31111/style.css"
};

const Chatbot: React.FC<ChatbotProps> = ({ userInput, onUpdateStatus }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [messageQueue, setMessageQueue] = useState<string[]>([]);
    const [audioQueue, setAudioQueue] = useState<string[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);

    // Sets up the Botpress widget in an iframe when the component mounts.
    useEffect(() => {
        const iframeContent = `
            <body>
                <script src='https://cdn.botpress.cloud/webchat/v0/inject.js'></script>
                <script>
                    window.botpressWebChat.init(${JSON.stringify(botConfig)});
                    window.botpressWebChat.onEvent(function (event) {
                        if (event.type === 'MESSAGE.RECEIVED') {
                            console.log('posting message')
                            parent.postMessage({
                                type: 'MESSAGE.RECEIVED',
                                data: event.value.payload
                            }, '*');
                        } else if (event.type === 'LIFECYCLE.LOADED') {
                            window.botpressWebChat.sendEvent({type: 'show'});
                        }
                    }, ['MESSAGE.RECEIVED', 'LIFECYCLE.LOADED']);
                    window.addEventListener('message', (event) => {
                        if (event.data && event.data.type === 'NEW_TEXT') {
                            window.botpressWebChat.sendPayload({ type: 'text', text: event.data.text });
                        }
                    });
                </script>
            </body>`;

        if (iframeRef.current) {
            iframeRef.current.srcdoc = iframeContent;
        }
    }, []);

    // Send user input to the bot
    useEffect(() => {
        if (userInput && iframeRef.current) {
            onUpdateStatus("Chatbot processing...");
            iframeRef.current.contentWindow?.postMessage({ type: 'NEW_TEXT', text: userInput }, '*');
        }
    }, [userInput, onUpdateStatus]);

    // Receive bot messages from the web widget
    useEffect(() => {
        const handleReceivedMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'MESSAGE.RECEIVED') {
                setMessageQueue(prevQueue => [...prevQueue, event.data.data.text]);
            }
        };

        window.addEventListener('message', handleReceivedMessage);
        return () => {
            window.removeEventListener('message', handleReceivedMessage);
        };
    }, []);

    // Plays audio from the queue
    const playNextAudio = () => {
        if (audioQueue.length > 0 && !isPlaying) {
          setIsPlaying(true);
          const nextAudioUrl = audioQueue.shift();
          if (audioRef.current && nextAudioUrl) {
            audioRef.current.src = nextAudioUrl;
            audioRef.current.play().catch(error => {
              console.error('Error during audio playback:', error);
              setIsPlaying(false);
            });
          }
        }
      };
      // Monitors the audio queue and plays audio when there is a change
      useEffect(() => {
        if (!isPlaying) {
          playNextAudio();
        }
      }, [audioQueue, isPlaying]);

      useEffect(() => {
        if (messageQueue.length > 0 && !isPlaying) {
          const fetchAudio = async () => {
            const message = messageQueue.shift();
            try {
              const response = await axios.post('http://localhost:3001/tts', { text: message }, { responseType: 'blob' });
              const blobUrl = URL.createObjectURL(response.data);
              setAudioQueue(prevQueue => [...prevQueue, blobUrl]);
            } catch (error) {
              console.error('Error fetching audio:', error);
            }
          };
          fetchAudio();
        }
      }, [messageQueue, isPlaying]);  // Fetch audio only when not currently playing
    
      
      useEffect(() => {
        if (!audioRef.current) {
          const audio = new Audio();
          audio.style.display = 'none';
          audio.volume = 0.75;
          document.body.appendChild(audio);
          audioRef.current = audio;
          audio.onended = () => {
            setIsPlaying(false);
            if (audioQueue.length > 0) {
              playNextAudio();
            }
          };
        }
        return () => {
          audioRef.current?.remove();
        };
      }, []);
    

    return (
        <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', height: '90%', zIndex: 1000 }}>
            <iframe ref={iframeRef} style={{ border: 'none', width: '100%', height: '100%' }} title="Botpress Webchat" />
        </div>
    );
};

export default Chatbot;