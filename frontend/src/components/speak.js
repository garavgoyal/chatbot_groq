let currentUtterance = null;

export function speak(text, rate = 1, onEnd = () => {}) {
  if (!text) return;
  window.speechSynthesis.cancel(); // stop anything currently playing

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate; // 0.5 = half speed, 1 = normal, 2 = double speed
  utterance.onend = onEnd;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}