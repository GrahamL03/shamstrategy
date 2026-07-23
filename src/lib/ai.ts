export async function queryLocalAI(prompt: string, model = 'llama3:8b-instruct-q4_K_M') {
  const startTime = performance.now();
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  const data = await response.json();
  const latency = Math.round(performance.now() - startTime);
  return { text: data.response, latency };
}