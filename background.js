// VerifAI — Background Service Worker

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VERIFAI_CHECK_IMAGE') {
    detectAIImage(message.imageUrl)
      .then(isAI => sendResponse({ isAI }))
      .catch(err => {
        console.error('VerifAI detection error:', err);
        sendResponse({ isAI: false, error: err.message });
      });
    return true;
  }
});

async function detectAIImage(imageUrl) {

  // Strip query parameters — fixes Reddit, Twitter, Facebook compressed thumbnails
  const cleanUrl = imageUrl.split('?')[0];
  console.log(`[VerifAI] Checking: ${cleanUrl}`);

  const { aiOrNotKey } = await chrome.storage.local.get('aiOrNotKey');

  if (!aiOrNotKey) {
    console.error('VerifAI: No AI or Not API key found.');
    return false;
  }

  const response = await fetch('https://api.aiornot.com/v1/reports/image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiOrNotKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ object: cleanUrl })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI or Not error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  console.log('AI or Not response:', JSON.stringify(data, null, 2));

  const verdict = data?.report?.verdict;
  const aiScore = data?.report?.ai?.confidence || 0;

  console.log(`[VerifAI] ${cleanUrl} → verdict: ${verdict}, confidence: ${aiScore}`);
  return verdict === 'ai' && aiScore >= 0.8;
}
