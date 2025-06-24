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
  const container = document.querySelector('.container');
  container.classList.remove('wide');
  const unsafeGauge = document.querySelector('.unsafe-gauge');
  unsafeGauge.classList.add('hidden');
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
    unsafeGauge.classList.remove('hidden');
  } catch (e) {
    resultDiv.innerHTML = `<span class='not-ok'>❌ Error occurred</span>`;
  }
});

const compareBtn = document.getElementById('compareBtn');
const comparisonSection = document.getElementById('comparison');

compareBtn.addEventListener('click', async () => {
  const container = document.querySelector('.container');
  container.classList.add('wide');
  const comment = document.getElementById('comment').value;
  if (!comment.trim()) {
    alert('Please enter a comment to compare.');
    return;
  }
  comparisonSection.style.display = 'flex';
  comparisonSection.innerHTML = `
    <div class="comparison-card" id="card-openai">
      <h2><span class="material-icons">auto_awesome</span>OpenAI</h2>
      <div class="unsafe-gauge">
        <label for="unsafeSliderOpenAI"><strong>Unsafe Score:</strong></label>
        <input type="range" id="unsafeSliderOpenAI" min="0" max="100" value="0" disabled>
        <span id="unsafeValueOpenAI">0%</span>
      </div>
      <div class="categories" id="categoriesOpenAI"></div>
      <div class="categories" id="scoresOpenAI"></div>
    </div>
    <div class="comparison-card" id="card-perspective">
      <h2><span class="material-icons">visibility</span>PerspectiveAPI</h2>
      <div class="unsafe-gauge">
        <label for="unsafeSliderPerspective"><strong>Unsafe Score:</strong></label>
        <input type="range" id="unsafeSliderPerspective" min="0" max="100" value="0" disabled>
        <span id="unsafeValuePerspective">0%</span>
      </div>
      <div class="categories" id="categoriesPerspective"></div>
      <div class="categories" id="scoresPerspective"></div>
    </div>
  `;

  // Fetch both APIs in parallel
  const [openai, perspective] = await Promise.all([
    fetch('/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, moderator: 'openai' })
    }).then(res => res.json()),
    fetch('/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, moderator: 'perspectiveapi' })
    }).then(res => res.json())
  ]);

  // Helper to update a card
  function updateCard(data, prefix) {
    if (!data || data.error) {
      document.getElementById(`categories${prefix}`).innerHTML = `<span class='not-ok'>❌ Error: ${data?.error || 'No response'}</span>`;
      return;
    }
    // Unsafe gauge
    const unsafeScore = calculateUnsafeScore(data.category_scores);
    const slider = document.getElementById(`unsafeSlider${prefix}`);
    const valueSpan = document.getElementById(`unsafeValue${prefix}`);
    const percent = Math.round(unsafeScore * 100);
    slider.value = percent;
    valueSpan.textContent = percent + '%';
    let color;
    if (unsafeScore < 0.3) color = '#1b7e3c';
    else if (unsafeScore < 0.7) color = '#f7b500';
    else color = '#d7263d';
    slider.style.accentColor = color;
    valueSpan.style.color = color;

    // Categories
    let categoriesHtml = '<strong>Categories:</strong><ul>';
    for (const [cat, flagged] of Object.entries(data.categories)) {
      categoriesHtml += `<li>${cat}: <strong>${flagged ? '🚩' : '✅'}</strong></li>`;
    }
    categoriesHtml += '</ul>';
    document.getElementById(`categories${prefix}`).innerHTML = categoriesHtml;

    // Scores
    let scoresHtml = '<strong>Scores:</strong><ul>';
    for (const [cat, score] of Object.entries(data.category_scores)) {
      scoresHtml += `<li>${cat}: ${score.toFixed(3)}</li>`;
    }
    scoresHtml += '</ul>';
    document.getElementById(`scores${prefix}`).innerHTML = scoresHtml;
  }

  updateCard(openai, 'OpenAI');
  updateCard(perspective, 'Perspective');
});