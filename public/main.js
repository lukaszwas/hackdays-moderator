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
let lastResults = {
  main: null,
  OpenAI: null,
  Perspective: null
};

function updateFlagsForThreshold(result, prefix, threshold) {
  if (!result) return;
  let categoriesHtml = '<strong>Categories:</strong><ul>';
  for (const [cat, score] of Object.entries(result.category_scores)) {
    const flagged = score >= threshold;
    categoriesHtml += `<li>${cat}: <strong>${flagged ? '🚩' : '✅'}</strong></li>`;
  }
  categoriesHtml += '</ul>';
  document.getElementById(`categories${prefix}`).innerHTML = categoriesHtml;
}

function renderMainVerdictAndFlags(data, threshold) {
  // Determine if any category is flagged at this threshold
  const flagged = Object.values(data.category_scores).some(score => score >= threshold);
  let verdict = flagged
    ? `<span>⚠️ Comment is NOT OK — please revise</span>`
    : `<span>✅ Comment is OK</span>`;
  let verdictDiv = document.getElementById('verdictmain');
  if (!verdictDiv) {
    verdictDiv = document.createElement('div');
    verdictDiv.id = 'verdictmain';
    verdictDiv.className = 'verdict';
    resultDiv.prepend(verdictDiv);
  }
  verdictDiv.innerHTML = verdict;
  verdictDiv.className = 'verdict ' + (flagged ? 'not-ok' : 'ok');
  let scoresHtml = '<div class="scores"><strong>Scores:</strong><ul>';
  for (const [cat, score] of Object.entries(data.category_scores)) {
    scoresHtml += `<li>${cat}: ${score.toFixed(3)}</li>`;
  }
  scoresHtml += '</ul></div>';
  // Render verdict, categories, and scores
  resultDiv.innerHTML = verdictDiv.outerHTML + `<div class="categories" id="categoriesmain"></div>` + scoresHtml;
  updateFlagsForThreshold(data, 'main', threshold);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const container = document.querySelector('.container');
  container.classList.remove('wide');
  const unsafeGauge = document.querySelector('.unsafe-gauge');
  unsafeGauge.classList.add('hidden');
  // Clear previous results
  resultDiv.innerHTML = '';
  resultDiv.style.display = 'none';
  const comparisonSection = document.getElementById('comparison');
  comparisonSection.style.display = 'none';
  comparisonSection.innerHTML = '';
  // Show main unsafe gauge only
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
    lastResults.main = data;
    if (data.error) {
      resultDiv.innerHTML = `<span class='not-ok'>❌ Error: ${data.error}</span>`;
      return;
    }
    // Render verdict and flags for default threshold
    renderMainVerdictAndFlags(data, 0.5);
    // Update unsafe gauge
    const unsafeScore = calculateUnsafeScore(data.category_scores);
    updateUnsafeGauge(unsafeScore);
    unsafeGauge.classList.remove('hidden');
    // Set slider to 50 and enable
    const unsafeSlider = document.getElementById('unsafeSlider');
    unsafeSlider.value = 50;
    unsafeSlider.disabled = false;
    document.getElementById('unsafeValue').textContent = '50%';
    unsafeSlider.oninput = function() {
      const threshold = this.value / 100;
      document.getElementById('unsafeValue').textContent = this.value + '%';
      renderMainVerdictAndFlags(lastResults.main, threshold);
      // Update slider color
      let color;
      if (threshold > 0.7) color = '#1b7e3c'; // green for lenient
      else if (threshold > 0.3) color = '#f7b500'; // yellow for medium
      else color = '#d7263d'; // red for strict
      this.style.accentColor = color;
      document.getElementById('unsafeValue').style.color = color;
    };
    // Set initial color
    unsafeSlider.style.accentColor = '#f7b500';
    document.getElementById('unsafeValue').style.color = '#f7b500';
  } catch (e) {
    // Remove verdict if present
    const verdictDiv = document.getElementById('verdictmain');
    if (verdictDiv) verdictDiv.remove();
    resultDiv.innerHTML = `<span class='not-ok'>❌ Error occurred</span>`;
  }
});

const compareBtn = document.getElementById('compareBtn');
const comparisonSection = document.getElementById('comparison');

compareBtn.addEventListener('click', async () => {
  const comment = document.getElementById('comment').value;
  if (!comment.trim()) {
    alert('Please enter a comment to compare.');
    return;
  }
  const container = document.querySelector('.container');
  container.classList.add('wide');
  // Hide main unsafe gauge when comparing
  const unsafeGauge = document.querySelector('.unsafe-gauge');
  unsafeGauge.classList.add('hidden');
  // Clear previous results
  resultDiv.innerHTML = '';
  resultDiv.style.display = 'none';
  comparisonSection.style.display = 'none';
  comparisonSection.innerHTML = '';

  comparisonSection.style.display = 'flex';
  comparisonSection.innerHTML = `
    <div id="comparison-controls" class="comparison-controls">
      <label for="comparisonSlider"><strong>Unsafe Score Threshold:</strong></label>
      <input type="range" id="comparisonSlider" min="0" max="100" value="50">
      <span id="comparisonValue">50%</span>
    </div>
    <div class="comparison-side-by-side">
    <div class="comparison-card" id="card-openai">
      <h2><span class="material-icons">auto_awesome</span>OpenAI</h2>
      <div class="verdict" id="verdictOpenAI"></div>
      <div class="categories" id="categoriesOpenAI"></div>
      <div class="scores" id="scoresOpenAI"></div>
    </div>
    <div class="comparison-card" id="card-perspective">
      <h2><span class="material-icons">visibility</span>PerspectiveAPI</h2>
      <div class="verdict" id="verdictPerspective"></div>
      <div class="categories" id="categoriesPerspective"></div>
      <div class="scores" id="scoresPerspective"></div>
    </div>
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

  lastResults.OpenAI = openai;
  lastResults.Perspective = perspective;

  // Helper to update a card (now only for flags and scores)
  function updateCard(data, prefix, threshold) {
    if (!data || data.error) {
      document.getElementById(`categories${prefix}`).innerHTML = `<span class='not-ok'>❌ Error: ${data?.error || 'No response'}</span>`;
      document.getElementById(`verdict${prefix}`).innerHTML = '';
      return;
    }
    // Verdict
    const flagged = Object.values(data.category_scores).some(score => score >= threshold);
    let verdict = flagged
      ? `<span>⚠️ Comment is NOT OK — please revise</span>`
      : `<span>✅ Comment is OK</span>`;
    const verdictDiv = document.getElementById(`verdict${prefix}`);
    verdictDiv.innerHTML = verdict;
    verdictDiv.className = 'verdict ' + (flagged ? 'not-ok' : 'ok');
    updateFlagsForThreshold(data, prefix, threshold);
    // Scores
    let scoresHtml = '<strong>Scores:</strong><ul>';
    for (const [cat, score] of Object.entries(data.category_scores)) {
      scoresHtml += `<li>${cat}: ${score.toFixed(3)}</li>`;
    }
    scoresHtml += '</ul>';
    document.getElementById(`scores${prefix}`).innerHTML = scoresHtml;
  }

  // Set up shared slider
  const comparisonSlider = document.getElementById('comparisonSlider');
  const comparisonValue = document.getElementById('comparisonValue');
  function updateAllComparisonFlags() {
    const threshold = comparisonSlider.value / 100;
    comparisonValue.textContent = comparisonSlider.value + '%';
    updateCard(lastResults.OpenAI, 'OpenAI', threshold);
    updateCard(lastResults.Perspective, 'Perspective', threshold);
    // Update slider color
    let color;
    if (threshold > 0.7) color = '#1b7e3c';
    else if (threshold > 0.3) color = '#f7b500';
    else color = '#d7263d';
    comparisonSlider.style.accentColor = color;
    comparisonValue.style.color = color;
  }
  comparisonSlider.oninput = updateAllComparisonFlags;
  // Set initial color and update
  comparisonSlider.style.accentColor = '#f7b500';
  comparisonValue.style.color = '#f7b500';
  updateAllComparisonFlags();
});