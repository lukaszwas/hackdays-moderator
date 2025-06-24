function calculateUnsafeScore(categoryScores) {
  const scores = Object.values(categoryScores);
  return Math.max(...scores);
}

function updateUnsafeGauge(score) {
  const slider = document.getElementById('unsafeSlider');
  const valueSpan = document.getElementById('unsafeValue');
  const percent = Math.round(score * 100);
  slider.value = percent;
  valueSpan.textContent = percent + '%';
  let color;
  if (score < 0.3) color = '#1b7e3c';      // green
  else if (score < 0.7) color = '#f7b500'; // yellow
  else color = '#d7263d';                  // red
  slider.style.accentColor = color;
  valueSpan.style.color = color;
}

const form = document.getElementById('moderationForm');
const resultDiv = document.getElementById('result');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '⏳ Checking...';
  const comment = document.getElementById('comment').value;
  const moderator = document.querySelector('input[name="moderator"]:checked').value;
  try {
    const res = await fetch('/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, moderator })
    });
    const data = await res.json();
    if (data.error) {
      resultDiv.innerHTML = `<span class='not-ok'>❌ Error: ${data.error}</span>`;
      return;
    }
    let categoriesHtml = '<div class="categories"><strong>Categories:</strong><ul>';
    for (const [cat, flagged] of Object.entries(data.categories)) {
      categoriesHtml += `<li>${cat}: <strong>${flagged ? '🚩' : '✅'}</strong></li>`;
    }
    categoriesHtml += '</ul></div>';
    let scoresHtml = '<div class="categories"><strong>Scores:</strong><ul>';
    for (const [cat, score] of Object.entries(data.category_scores)) {
      scoresHtml += `<li>${cat}: ${score.toFixed(3)}</li>`;
    }
    scoresHtml += '</ul></div>';
    let message = data.flagged
      ? `<span class='not-ok'>⚠️ Comment is NOT OK — please revise</span>`
      : `<span class='ok'>✅ Comment is OK</span>`;
    resultDiv.innerHTML = `${message}${categoriesHtml}${scoresHtml}`;
    // Update unsafe gauge
    const unsafeScore = calculateUnsafeScore(data.category_scores);
    updateUnsafeGauge(unsafeScore);
  } catch (e) {
    resultDiv.innerHTML = `<span class='not-ok'>❌ Error occurred</span>`;
  }
});