import { useState, useRef } from 'react';

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  function startListening(onResult) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition isn't supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }

  return { isListening, startListening };
}