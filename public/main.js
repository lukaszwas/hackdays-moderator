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
  Perspective: null,
  ftgpt: null
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
    scoresHtml += `<li>${cat}: ${(score * 100).toFixed(0)}%</li>`;
  }
  scoresHtml += '</ul></div>';
  // Render verdict, categories, and scores
  resultDiv.innerHTML = verdictDiv.outerHTML + `<div class="categories" id="categoriesmain"></div>` + scoresHtml;
  updateFlagsForThreshold(data, 'main', threshold);
}

const compareBtn = document.getElementById('compareBtn');
const comparisonSection = document.getElementById('comparison');

compareBtn.addEventListener('click', async () => {
  const comment = document.getElementById('comment').value;
  if (!comment.trim()) {
    alert('Please enter a comment to compare.');
    return;
  }
  // Do NOT clear or overwrite the comparisonSection.innerHTML
  // Only update the flags and scores in the existing cards

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
      <div class="comparison-card" id="card-ftgpt">
        <h2><span class="material-icons">star</span>Fine-tuned GPT</h2>
        <div class="verdict" id="verdictftgpt"></div>
        <div class="categories" id="categoriesftgpt"></div>
        <div class="scores" id="scoresftgpt"></div>
      </div>
    </div>
  `;

  // Fetch all three APIs in parallel
  const [openai, perspective, ftgpt] = await Promise.all([
    fetch('/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, moderator: 'openai' })
    }).then(res => res.json()),
    fetch('/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, moderator: 'perspectiveapi' })
    }).then(res => res.json()),
    fetch('/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, moderator: 'ft-gpt' })
    }).then(res => res.json())
  ]);

  lastResults.OpenAI = openai;
  lastResults.Perspective = perspective;
  lastResults.ftgpt = ftgpt;

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
      scoresHtml += `<li>${cat}: ${(score * 100).toFixed(0)}%</li>`;
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
    updateCard(lastResults.ftgpt, 'ftgpt', threshold);
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

// Analysis form handler
const analysisForm = document.getElementById('analysisForm');
const analysisResultDiv = document.getElementById('analysisResult');

if (analysisForm) {
  analysisForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    analysisResultDiv.style.display = 'block';
    analysisResultDiv.innerHTML = '⏳ Analyzing...';
    const text = document.getElementById('analysisText').value;
    try {
      const res = await fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.error) {
        analysisResultDiv.innerHTML = `<span class='not-ok'>❌ Error: ${data.error}</span>`;
        return;
      }
      // Display analysis
      const themes = Array.isArray(data.themes) ? data.themes.join(', ') : data.themes;
      const tone = data.tone || 'Unknown';
      const sensitivity = typeof data.sensitivity === 'number' ? Math.round(data.sensitivity) : 'N/A';
      analysisResultDiv.innerHTML = `
        <div><strong>Themes:</strong> ${themes}</div>
        <div><strong>Emotional Tone:</strong> ${tone}</div>
        <div><strong>Sensitivity Score:</strong> <span id="sensitivityScore">${sensitivity}%</span></div>
      `;
      // Set unsafe score threshold slider automatically
      const unsafeSlider = document.getElementById('unsafeSlider');
      const unsafeValue = document.getElementById('unsafeValue');
      if (unsafeSlider && unsafeValue && typeof data.sensitivity === 'number') {
        const thresholdValue = 100 - Math.round(data.sensitivity);
        // Animate the slider value
        const startValue = parseInt(unsafeSlider.value, 10);
        const endValue = thresholdValue;
        const duration = 500; // ms
        const startTime = performance.now();
        function animateSlider(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const currentValue = Math.round(startValue + (endValue - startValue) * progress);
          unsafeSlider.value = currentValue;
          unsafeValue.textContent = currentValue + '%';
          if (typeof unsafeSlider.oninput === 'function') {
            unsafeSlider.oninput.call(unsafeSlider);
          }
          if (progress < 1) {
            requestAnimationFrame(animateSlider);
          }
        }
        requestAnimationFrame(animateSlider);
      }
      // Update slider color on manual input as well
      if (unsafeSlider) {
        // Set initial value on page load
        unsafeValue.textContent = unsafeSlider.value + '%';
        unsafeSlider.oninput = function() {
          const val = parseInt(this.value, 10);
          unsafeValue.textContent = val + '%';
        };
      }
      // Also update setSliderColor for animation
      function setSliderColor(val) {
        // No color changes
      }
    } catch (err) {
      analysisResultDiv.innerHTML = `<span class='not-ok'>❌ Error occurred</span>`;
    }
  });
}

// Ensure slider % updates live on page load
const unsafeSlider = document.getElementById('unsafeSlider');
const unsafeValue = document.getElementById('unsafeValue');
if (unsafeSlider && unsafeValue) {
  unsafeValue.textContent = unsafeSlider.value + '%';
  unsafeSlider.oninput = function() {
    const val = parseInt(this.value, 10);
    unsafeValue.textContent = val + '%';
  };
}